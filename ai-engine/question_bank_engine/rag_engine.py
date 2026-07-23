"""
RAG Engine
==========
Retrieval-Augmented Generation for intelligent question generation.
"""

import logging
import json
import re
from typing import List, Dict, Optional

from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from config import config
from vector_store import VectorStore

logger = logging.getLogger(__name__)


class RAGEngine:
    """Retrieval-Augmented Generation Engine"""

    def __init__(self):
        self.logger = logger
        self.vector_store = VectorStore()
        self.llm = self._initialize_llm()

    def _initialize_llm(self):
        """Initialize LLM based on configuration"""
        provider = config.llm.provider

        if provider == "groq":
            if not config.llm.groq_api_key:
                raise ValueError("GROQ_API_KEY not set")

            self.logger.info(f"Initializing Groq LLM: {config.llm.groq_model}")
            return ChatGroq(
                model=config.llm.groq_model,
                api_key=config.llm.groq_api_key,
                temperature=config.llm.groq_temperature,
                max_tokens=config.llm.groq_max_tokens,
            )

        elif provider == "openai":
            if not config.llm.openai_api_key:
                raise ValueError("OPENAI_API_KEY not set")

            self.logger.info(f"Initializing OpenAI LLM: {config.llm.openai_model}")
            return ChatOpenAI(
                model=config.llm.openai_model,
                api_key=config.llm.openai_api_key,
                temperature=config.llm.openai_temperature,
                max_tokens=config.llm.openai_max_tokens,
            )

        else:
            raise ValueError(f"Unsupported LLM provider: {provider}")

    def retrieve_context(self, query: str, top_k: int = 5) -> str:
        """Retrieve relevant context from knowledge base"""
        relevant_chunks = self.vector_store.search(query, top_k=top_k)

        if not relevant_chunks:
            return ""

        # Combine chunks into context
        context_parts = []
        for i, chunk in enumerate(relevant_chunks, 1):
            context_parts.append(f"--- Source {i} (Similarity: {chunk['similarity']:.0%}) ---\n{chunk['content']}")

        return "\n\n".join(context_parts)

    def generate_response(self, query: str, context: str = None) -> str:
        """Generate a response using RAG"""
        if context is None:
            context = self.retrieve_context(query)

        if not context:
            # Fallback to LLM without context
            messages = [HumanMessage(content=query)]
        else:
            # Use RAG with context
            rag_prompt = f"""Based on the following context, answer the question.

Context:
{context}

Question: {query}

Answer:"""
            messages = [HumanMessage(content=rag_prompt)]

        response = self.llm.invoke(messages)
        return response.content

    def get_collection_stats(self) -> Dict:
        """Get knowledge base statistics"""
        return self.vector_store.get_collection_stats()

    def search_knowledge_base(self, query: str, top_k: int = 5) -> List[Dict]:
        """Search the knowledge base"""
        return self.vector_store.search(query, top_k=top_k)


class QuestionGenerator(RAGEngine):
    """AI-powered Question Generator using RAG"""

    def generate_questions(
        self,
        topic: str,
        difficulty: str = "medium",
        question_type: str = "multiple_choice",
        count: int = 3,
        use_rag: bool = True,
    ) -> List[Dict]:
        """Generate questions for a topic"""

        if use_rag:
            context = self.retrieve_context(topic, top_k=3)
        else:
            context = ""

        questions = []
        rejections = []
        verify = config.question_generation.verify_answers
        attempts_allowed = max(1, config.question_generation.verify_max_attempts) if verify else 1

        for i in range(count):
            # Each question gets several shots: a rejected draft is retried rather
            # than silently dropped, so `count` still means what the caller asked.
            for attempt in range(1, attempts_allowed + 1):
                prompt = self._build_question_prompt(
                    topic=topic,
                    difficulty=difficulty,
                    question_type=question_type,
                    context=context,
                    question_number=i + 1,
                )

                # Steer away from repeats: show the LLM what it already produced
                if questions:
                    previous = "\n".join(f"- {q.get('question', '')}" for q in questions)
                    prompt += (
                        f"\n\nIMPORTANT: You already generated these questions — "
                        f"create one that tests a DIFFERENT concept or scenario:\n{previous}"
                    )

                try:
                    response = self.llm.invoke([HumanMessage(content=prompt)])
                    question = self._parse_question_response(response.content, question_type)
                except Exception as e:
                    self.logger.error(f"Error generating question {i + 1}: {e}")
                    rejections.append(f"q{i + 1} attempt {attempt}: {e}")
                    continue

                if not question:
                    self.logger.warning(f"Failed to parse question {i + 1}")
                    rejections.append(f"q{i + 1} attempt {attempt}: unparseable response")
                    continue

                reason = self._check_structure(question, question_type)
                if reason is None and verify:
                    reason = self._verify_answer(question, question_type)

                if reason:
                    self.logger.warning(
                        f"Rejected question {i + 1} "
                        f"(attempt {attempt}/{attempts_allowed}): {reason}"
                    )
                    rejections.append(f"q{i + 1} attempt {attempt}: {reason}")
                    continue

                question["verified"] = verify
                questions.append(question)
                self.logger.info(f"Generated question {i + 1}/{count}")
                break

        # Read by the engine layer: a caller receiving fewer questions than it
        # asked for needs to know whether that was a config fault or a quality one.
        self.last_run_rejections = rejections
        return questions


    # ── Self-verification ──────────────────────────────────────────────────
    # The generator regularly emits a correct_answer that contradicts its own
    # explanation, or that is not among the options at all. Neither is visible
    # to JSON parsing, so check structure first, then re-solve independently.

    @staticmethod
    def _norm(value) -> str:
        """Loose comparison key: case, spacing and punctuation carry no meaning."""
        return re.sub(r"[^a-z0-9.]", "", str(value).lower())

    def _check_structure(self, question: Dict, question_type: str) -> Optional[str]:
        """Cheap structural checks. Returns a rejection reason, or None if sound."""
        text = (question.get("question") or "").strip()
        answer = str(question.get("correct_answer") or "").strip()

        if not text:
            return "empty question text"
        if not answer:
            return "no correct_answer"

        if question_type == "multiple_choice":
            options = question.get("options") or []
            if len(options) < 2:
                return "only %d option(s)" % len(options)
            keys = [self._norm(o) for o in options]
            if len(set(keys)) != len(keys):
                return "duplicate options"
            if self._norm(answer) not in keys:
                return "correct_answer %r is not among the options" % answer

        return None

    def _verify_answer(self, question: Dict, question_type: str) -> Optional[str]:
        """Re-solve the question blind. Returns a rejection reason, or None if it agrees."""
        text = question["question"]
        claimed = str(question.get("correct_answer", "")).strip()
        options = question.get("options") or []

        if question_type == "multiple_choice" and options:
            listed = "\n".join(
                "%s. %s" % (chr(65 + i), o) for i, o in enumerate(options)
            )
            prompt = (
                "Solve this problem from scratch. Work through the arithmetic step "
                "by step, then choose the single best option.\n\n"
                "Question: %s\n\nOptions:\n%s\n\n"
                "Reply with JSON only, no prose: "
                '{"working": "<your step-by-step calculation>", '
                '"answer": "<exact text of the option you chose>"}' % (text, listed)
            )
        else:
            prompt = (
                "Answer this question from scratch. Work through it step by step.\n\n"
                "Question: %s\n\n"
                "Reply with JSON only, no prose: "
                '{"working": "<your reasoning>", "answer": "<your final answer>"}' % text
            )

        try:
            # Deliberately withholds the claimed answer and explanation -- showing
            # them invites the model to agree rather than re-derive.
            response = self.llm.invoke([HumanMessage(content=prompt)])
            start = response.content.find("{")
            end = response.content.rfind("}") + 1
            if start == -1 or end <= start:
                # Unparseable verifier output is not evidence of a bad question.
                return None
            verdict = json.loads(response.content[start:end], strict=False)
        except Exception as e:
            self.logger.warning("Verification call failed, accepting unverified: %s" % e)
            return None

        got = str(verdict.get("answer", "")).strip()
        if not got:
            return None
        if self._answers_agree(got, claimed, options):
            return None

        return "verifier answered %r but the question claims %r" % (got, claimed)

    _LABEL = re.compile(r"^\s*\(?([A-Za-z])\)?\s*[.):\-]\s*")

    def _answers_agree(self, got: str, claimed: str, options) -> bool:
        """Do two answer strings refer to the same option?

        Models label their choice inconsistently -- "B", "B.", "(B) 32%",
        "32% increase" -- so compare the bare text, the text with any leading
        option label stripped, and the option each label points at.
        """
        options = options or []

        def variants(value: str):
            value = str(value).strip()
            out = {self._norm(value)}
            stripped = self._LABEL.sub("", value)
            out.add(self._norm(stripped))
            # A lone label ("B") resolves through the options list.
            label = value.strip().strip("().").strip()
            if len(label) == 1 and label.isalpha():
                idx = ord(label.upper()) - 65
                if 0 <= idx < len(options):
                    out.add(self._norm(options[idx]))
            # A labelled answer ("B. 32%") also resolves through its label.
            m = self._LABEL.match(value)
            if m:
                idx = ord(m.group(1).upper()) - 65
                if 0 <= idx < len(options):
                    out.add(self._norm(options[idx]))
            out.discard("")
            return out

        return bool(variants(got) & variants(claimed))

    def _build_question_prompt(
        self,
        topic: str,
        difficulty: str,
        question_type: str,
        context: str,
        question_number: int,
    ) -> str:
        """Build the prompt for question generation"""

        if question_type == "multiple_choice":
            return f"""Generate a {difficulty} difficulty multiple choice question on the topic: "{topic}"

{f"Use this context: {context}" if context else ""}

Requirements:
- Clear, unambiguous question
- 4 distinct options (A, B, C, D)
- One correct answer
- Options should have similar length
- No tricks or ambiguity

Respond ONLY in this JSON format:
{{
    "question": "The question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": "Option A",
    "explanation": "Brief explanation of why this is correct",
    "difficulty": "{difficulty}",
    "topic": "{topic}"
}}"""

        elif question_type == "short_answer":
            return f"""Generate a {difficulty} difficulty short answer question on: "{topic}"

{f"Use this context: {context}" if context else ""}

Requirements:
- Clear, specific question
- Expected answer should be 1-3 sentences
- Focused on key concepts

Respond ONLY in this JSON format:
{{
    "question": "The question text here?",
    "answer": "Expected answer",
    "keywords": ["key1", "key2", "key3"],
    "explanation": "Full explanation",
    "difficulty": "{difficulty}",
    "topic": "{topic}"
}}"""

        elif question_type == "true_false":
            return f"""Generate a {difficulty} difficulty true/false question on: "{topic}"

{f"Use this context: {context}" if context else ""}

Requirements:
- Statement should be clear
- Not ambiguous
- Educational value

Respond ONLY in this JSON format:
{{
    "question": "Statement here?",
    "correct_answer": true,
    "explanation": "Why this statement is true/false",
    "difficulty": "{difficulty}",
    "topic": "{topic}"
}}"""

        elif question_type == "flashcard":
            return f"""Create a {difficulty} difficulty flashcard on the topic: "{topic}"

{f"Use this context: {context}" if context else ""}

Requirements:
- Front: a short, specific prompt/question/term (memorable, not a full paragraph)
- Back: a concise, correct answer (1-3 sentences)

Respond ONLY in this JSON format:
{{
    "question": "The flashcard front here",
    "answer": "The flashcard back here",
    "explanation": "Optional extra context, or empty string",
    "difficulty": "{difficulty}",
    "topic": "{topic}"
}}"""

        elif question_type in ("lesson", "voice_lesson"):
            style = (
                "Write it as a spoken narration script — natural, conversational sentences a "
                "narrator would read aloud, no bullet points or headings."
                if question_type == "voice_lesson"
                else "Write it as a structured lesson with short paragraphs; headings are fine."
            )
            return f"""Write a {difficulty} difficulty lesson on the topic: "{topic}"

{f"Use this context: {context}" if context else ""}

Requirements:
- {style}
- 3-6 paragraphs, self-contained, teaches the topic from scratch
- Clear and accurate

Respond ONLY in this JSON format:
{{
    "question": "Lesson title here",
    "answer": "Full lesson body here (the paragraphs)",
    "explanation": "One-sentence summary of what this lesson covers",
    "difficulty": "{difficulty}",
    "topic": "{topic}"
}}"""

        else:
            # Generic format
            return f"""Generate a {difficulty} difficulty {question_type} question on: "{topic}"

{f"Use this context: {context}" if context else ""}

Create an engaging, clear question appropriate for skill assessment.

Respond in JSON format with: question, answer/options, explanation, difficulty, topic"""

    def _parse_question_response(self, response: str, question_type: str) -> Optional[Dict]:
        """Parse LLM response to extract question"""
        try:
            # Try to extract JSON
            json_start = response.find("{")
            json_end = response.rfind("}") + 1

            if json_start != -1 and json_end > json_start:
                json_str = response[json_start:json_end]
                # strict=False: multi-paragraph answers (lessons) commonly contain
                # raw newlines inside string values, which strict JSON rejects as
                # invalid control characters even though the content is otherwise
                # well-formed.
                question = json.loads(json_str, strict=False)

                # Validate required fields
                if "question" in question:
                    question["question_type"] = question_type
                    return question

            self.logger.warning(f"Could not parse response: {response[:100]}")
            return None

        except json.JSONDecodeError as e:
            self.logger.error(f"JSON parsing error: {e}")
            return None

    def generate_batch(
        self,
        topics: List[str],
        difficulty: str = "medium",
        questions_per_topic: int = 2,
    ) -> List[Dict]:
        """Generate questions for multiple topics"""

        all_questions = []

        for topic in topics:
            self.logger.info(f"Generating questions for: {topic}")

            questions = self.generate_questions(
                topic=topic,
                difficulty=difficulty,
                question_type="multiple_choice",
                count=questions_per_topic,
            )

            all_questions.extend(questions)

        self.logger.info(f"Generated {len(all_questions)} questions total")
        return all_questions


if __name__ == "__main__":
    # Test RAG & Question Generation
    try:
        generator = QuestionGenerator()

        # Test question generation
        print("Generating sample questions...\n")

        questions = generator.generate_questions(
            topic="Profit and Loss",
            difficulty="medium",
            question_type="multiple_choice",
            count=2,
        )

        for i, q in enumerate(questions, 1):
            print(f"\nQuestion {i}:")
            print(f"  Q: {q.get('question')}")
            if "options" in q:
                for j, opt in enumerate(q["options"], 1):
                    print(f"  {chr(64+j)}: {opt}")
            print(f"  Answer: {q.get('correct_answer')}")
            print(f"  Explanation: {q.get('explanation')}")

    except Exception as e:
        print(f"❌ Error: {e}")
