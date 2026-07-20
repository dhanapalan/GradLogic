# 10 — Load & Stress Validation

**Wave:** 2  
**Owner:** QA + DevOps  
**Entry:** Performance baselines exist; staging sized

## Load examples

| ID | Scenario | Status |
|----|----------|--------|
| LOAD-01 | 500 students in exam sessions concurrently | BACKLOG |
| LOAD-02 | 1,000 concurrent logins (mixed roles) | BACKLOG |
| LOAD-03 | 50 colleges opening analytics/reports | BACKLOG |
| LOAD-04 | 100 parallel `GET /exam-sessions/my-drives` | BACKLOG |

## Stress examples

| ID | Scenario | Status |
|----|----------|--------|
| STRESS-01 | 10,000 AI question generation requests (queued) | BACKLOG |
| STRESS-02 | Massive concurrent exam submits at timer end | BACKLOG |
| STRESS-03 | DB failover / reconnect during live exam | BACKLOG |
| STRESS-04 | Redis unavailable; graceful degrade | BACKLOG |

## Pass criteria (draft)

- Error rate < 1% under LOAD-01  
- No data corruption on submit race  
- Clear operator runbook for STRESS-03  

## Tools

k6 / Locust + staging compose; never against production without approval.
