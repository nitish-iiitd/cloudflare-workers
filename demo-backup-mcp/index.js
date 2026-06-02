const backupJobs = [
    {
        job_id: "backup_job_1001",
        username: "demo_user_1",
        domain: "example-one.com",
        backup_type: "full",
        status: "completed",
        created_at: "2026-06-01T10:00:00Z",
        size_mb: 512,
    },
    {
        job_id: "backup_job_1002",
        username: "demo_user_2",
        domain: "example-two.com",
        backup_type: "database",
        status: "running",
        created_at: "2026-06-02T04:30:00Z",
        size_mb: 128,
    },
    {
        job_id: "backup_job_1003",
        username: "demo_user_3",
        domain: "example-three.com",
        backup_type: "home",
        status: "failed",
        created_at: "2026-06-02T07:15:00Z",
        size_mb: 900,
    },
];

const backupPolicies = [
    {
        policy_id: "daily_7_days",
        name: "Daily backup with 7 days retention",
        schedule: "daily",
        retention_days: 7,
    },
    {
        policy_id: "weekly_30_days",
        name: "Weekly backup with 30 days retention",
        schedule: "weekly",
        retention_days: 30,
    },
];

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data, null, 2), {
        status,
        headers: {
            "content-type": "application/json",
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET, POST, OPTIONS",
            "access-control-allow-headers": "content-type, authorization",
        },
    });
}

function mcpResult(id, result) {
    return {
        jsonrpc: "2.0",
        id,
        result,
    };
}

function mcpError(id, code, message) {
    return {
        jsonrpc: "2.0",
        id,
        error: {
            code,
            message,
        },
    };
}

function toolText(data, isError = false) {
    const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);

    const response = {
        content: [
            {
                type: "text",
                text,
            },
        ],
    };

    if (isError) {
        response.isError = true;
    }

    return response;
}

function getTools() {
    return [
        {
            name: "list_backup_jobs",
            description: "List demo backup jobs. Optionally filter by status or username.",
            inputSchema: {
                type: "object",
                properties: {
                    status: {
                        type: "string",
                        description: "Optional backup status filter",
                        enum: ["queued", "running", "completed", "failed", "cancelled"],
                    },
                    username: {
                        type: "string",
                        description: "Optional hosting account username filter",
                    },
                },
            },
        },
        {
            name: "get_backup_job",
            description: "Get details of a backup job by job_id.",
            inputSchema: {
                type: "object",
                properties: {
                    job_id: {
                        type: "string",
                        description: "Backup job ID",
                    },
                },
                required: ["job_id"],
            },
        },
        {
            name: "create_backup_job",
            description: "Create a fake backup job for a hosting account.",
            inputSchema: {
                type: "object",
                properties: {
                    username: {
                        type: "string",
                        description: "Hosting account username",
                    },
                    domain: {
                        type: "string",
                        description: "Domain name for which backup is requested",
                    },
                    backup_type: {
                        type: "string",
                        description: "Type of backup",
                        enum: ["home", "database", "full"],
                    },
                },
                required: ["username", "backup_type"],
            },
        },
        {
            name: "cancel_backup_job",
            description: "Cancel a demo backup job.",
            inputSchema: {
                type: "object",
                properties: {
                    job_id: {
                        type: "string",
                        description: "Backup job ID",
                    },
                },
                required: ["job_id"],
            },
        },
        {
            name: "list_backup_policies",
            description: "List available demo backup policies.",
            inputSchema: {
                type: "object",
                properties: {},
            },
        },
    ];
}

function callTool(name, args = {}) {
    if (name === "list_backup_jobs") {
        let jobs = [...backupJobs];

        if (args.status) {
            jobs = jobs.filter((job) => job.status === args.status);
        }

        if (args.username) {
            jobs = jobs.filter((job) => job.username === args.username);
        }

        return toolText(jobs);
    }

    if (name === "get_backup_job") {
        const job = backupJobs.find((item) => item.job_id === args.job_id);

        if (!job) {
            return toolText(`No backup job found for job_id=${args.job_id}`, true);
        }

        return toolText(job);
    }

    if (name === "create_backup_job") {
        if (!args.username) {
            return toolText("username is required", true);
        }

        if (!["home", "database", "full"].includes(args.backup_type)) {
            return toolText("backup_type must be one of: home, database, full", true);
        }

        const newJob = {
            job_id: `backup_job_${Date.now()}`,
            username: args.username,
            domain: args.domain || "unknown-domain.test",
            backup_type: args.backup_type,
            status: "queued",
            created_at: new Date().toISOString(),
            size_mb: 0,
        };

        backupJobs.push(newJob);

        return toolText(newJob);
    }

    if (name === "cancel_backup_job") {
        const job = backupJobs.find((item) => item.job_id === args.job_id);

        if (!job) {
            return toolText(`No backup job found for job_id=${args.job_id}`, true);
        }

        if (["completed", "failed", "cancelled"].includes(job.status)) {
            return toolText(
                `Backup job ${job.job_id} cannot be cancelled because it is already ${job.status}.`,
                true
            );
        }

        job.status = "cancelled";

        return toolText({
            message: "Backup job cancelled",
            job,
        });
    }

    if (name === "list_backup_policies") {
        return toolText(backupPolicies);
    }

    return toolText(`Unknown tool: ${name}`, true);
}

async function handleMcpRequest(request) {
    let body;

    try {
        body = await request.json();
    } catch (error) {
        return jsonResponse(mcpError(null, -32700, "Invalid JSON body"), 400);
    }

    const id = body.id;
    const method = body.method;
    const params = body.params || {};

    if (method === "initialize") {
        return jsonResponse(
            mcpResult(id, {
                protocolVersion: "2025-03-26",
                capabilities: {
                    tools: {},
                },
                serverInfo: {
                    name: "backup-mcp",
                    version: "1.0.0",
                },
            })
        );
    }

    if (method === "tools/list") {
        return jsonResponse(
            mcpResult(id, {
                tools: getTools(),
            })
        );
    }

    if (method === "tools/call") {
        const toolName = params.name;
        const toolArgs = params.arguments || {};

        return jsonResponse(mcpResult(id, callTool(toolName, toolArgs)));
    }

    return jsonResponse(mcpError(id, -32601, `Method not found: ${method}`), 400);
}

export default {
    async fetch(request) {
        const url = new URL(request.url);

        if (request.method === "OPTIONS") {
            return jsonResponse({});
        }

        if (url.pathname === "/") {
            return jsonResponse({
                name: "backup-mcp",
                status: "ok",
                mcp_endpoint: "/mcp",
                tools: getTools().map((tool) => tool.name),
            });
        }

        if (url.pathname === "/mcp") {
            if (request.method !== "POST") {
                return jsonResponse({ error: "Use POST /mcp" }, 405);
            }

            return handleMcpRequest(request);
        }

        return jsonResponse({ error: "Not found" }, 404);
    },
};