import { Request, Response } from "express";
import { query, queryOne } from "../config/database.js";

export interface WorkflowStep {
  id: string;
  name: string;
  type: "assessment" | "email" | "notification" | "approval" | "delay";
  config: Record<string, any>;
  order: number;
}

export interface WorkflowCondition {
  field: string;
  operator: "equals" | "contains" | "greater_than" | "less_than";
  value: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  trigger_event: string;
  steps: WorkflowStep[];
  conditions: WorkflowCondition[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const listWorkflows = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 50, search = "", status = "all", category = "" } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = "WHERE deleted_at IS NULL";
    const params: any[] = [];

    if (search) {
      whereClause += ` AND (w.name ILIKE $${params.length + 1} OR w.description ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }

    if (status && status !== "all") {
      whereClause += ` AND w.is_active = $${params.length + 1}`;
      params.push(status === "active");
    }

    if (category) {
      whereClause += ` AND w.category = $${params.length + 1}`;
      params.push(category);
    }

    const countResult = await query(
      `SELECT COUNT(*) as count FROM workflows w ${whereClause}`,
      params
    );
    const total = parseInt(countResult[0]?.count || 0);

    const result = await query(
      `SELECT w.id, w.name, w.description, w.is_active, w.trigger_event, w.category,
              w.created_by, w.created_at, w.updated_at,
              COUNT(DISTINCT ws.id) as step_count
       FROM workflows w
       LEFT JOIN workflow_steps ws ON w.id = ws.workflow_id
       ${whereClause}
       GROUP BY w.id
       ORDER BY w.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, Number(limit), offset]
    );

    res.json({
      success: true,
      data: result,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error("Error listing workflows:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list workflows",
    });
  }
};

export const getWorkflow = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const workflowResult = await query(
      `SELECT * FROM workflows WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (workflowResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Workflow not found",
      });
    }

    const workflow = workflowResult[0];

    // Get steps
    const stepsResult = await query(
      `SELECT id, name, type, config, order_index as "order"
       FROM workflow_steps WHERE workflow_id = $1 ORDER BY order_index ASC`,
      [id]
    );

    // Get conditions
    const conditionsResult = await query(
      `SELECT field, operator, value FROM workflow_conditions WHERE workflow_id = $1`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...workflow,
        steps: stepsResult,
        conditions: conditionsResult,
      },
    });
  } catch (error: any) {
    console.error("Error getting workflow:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get workflow",
    });
  }
};

export const createWorkflow = async (req: Request, res: Response) => {
  try {
    const { name, description, trigger_event, category = null, steps = [], conditions = [] } =
      req.body;

    if (!name || !trigger_event) {
      return res.status(400).json({
        success: false,
        message: "name and trigger_event are required",
      });
    }

    const id = `wf_${Date.now()}`;

    await query(
      `INSERT INTO workflows (id, name, description, trigger_event, category, created_by, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, name, description, trigger_event, category, req.user?.userId || "system", true]
    );

    // Add steps
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      await query(
        `INSERT INTO workflow_steps (workflow_id, name, type, config, order_index)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, step.name, step.type, JSON.stringify(step.config), i]
      );
    }

    // Add conditions
    for (const cond of conditions) {
      await query(
        `INSERT INTO workflow_conditions (workflow_id, field, operator, value)
         VALUES ($1, $2, $3, $4)`,
        [id, cond.field, cond.operator, cond.value]
      );
    }

    // Log audit
    await query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user?.userId || "system", "CREATE_WORKFLOW", "workflow", id, req.ip]
    );

    res.status(201).json({
      success: true,
      message: "Workflow created successfully",
      data: { id },
    });
  } catch (error: any) {
    console.error("Error creating workflow:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create workflow",
    });
  }
};

export const updateWorkflow = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, trigger_event, is_active, category } = req.body;

    const workflowResult = await query(
      `SELECT * FROM workflows WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (workflowResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Workflow not found",
      });
    }

    await query(
      `UPDATE workflows SET name = COALESCE($1, name),
                            description = COALESCE($2, description),
                            trigger_event = COALESCE($3, trigger_event),
                            is_active = COALESCE($4, is_active),
                            category = COALESCE($5, category),
                            updated_at = NOW()
       WHERE id = $6`,
      [name, description, trigger_event, is_active, category, id]
    );

    // Log audit
    await query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, changes, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user?.userId || "system",
        "UPDATE_WORKFLOW",
        "workflow",
        id,
        JSON.stringify({ name, description, trigger_event, is_active }),
        req.ip,
      ]
    );

    res.json({
      success: true,
      message: "Workflow updated successfully",
    });
  } catch (error: any) {
    console.error("Error updating workflow:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update workflow",
    });
  }
};

export const deleteWorkflow = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const workflowResult = await query(
      `SELECT * FROM workflows WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (workflowResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Workflow not found",
      });
    }

    await query(
      `UPDATE workflows SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    // Log audit
    await query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user?.userId || "system", "DEACTIVATE_WORKFLOW", "workflow", id, req.ip]
    );

    res.json({
      success: true,
      message: "Workflow deactivated successfully",
    });
  } catch (error: any) {
    console.error("Error deleting workflow:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete workflow",
    });
  }
};

export const updateWorkflowSteps = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { steps } = req.body;

    if (!Array.isArray(steps)) {
      return res.status(400).json({
        success: false,
        message: "steps must be an array",
      });
    }

    // Delete existing steps
    await query(`DELETE FROM workflow_steps WHERE workflow_id = $1`, [id]);

    // Add new steps
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      await query(
        `INSERT INTO workflow_steps (workflow_id, name, type, config, order_index)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, step.name, step.type, JSON.stringify(step.config), i]
      );
    }

    // Log audit
    await query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, changes, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user?.userId || "system",
        "UPDATE_WORKFLOW_STEPS",
        "workflow",
        id,
        JSON.stringify({ step_count: steps.length }),
        req.ip,
      ]
    );

    res.json({
      success: true,
      message: "Workflow steps updated successfully",
      step_count: steps.length,
    });
  } catch (error: any) {
    console.error("Error updating workflow steps:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update workflow steps",
    });
  }
};
