const domains = [
    {
        domain: "example-one.com",
        username: "demo_user_1",
        status: "active",
        registrar: "Bluehost Demo Registrar",
        nameservers: ["ns1.demo-hosting.com", "ns2.demo-hosting.com"],
        expires_at: "2026-12-20",
        auto_renew: true,
    },
    {
        domain: "example-two.com",
        username: "demo_user_2",
        status: "active",
        registrar: "Bluehost Demo Registrar",
        nameservers: ["ns1.demo-hosting.com", "ns2.demo-hosting.com"],
        expires_at: "2026-09-15",
        auto_renew: false,
    },
    {
        domain: "expired-demo.com",
        username: "demo_user_3",
        status: "expired",
        registrar: "Demo Domains Inc",
        nameservers: ["ns1.old-demo.com", "ns2.old-demo.com"],
        expires_at: "2026-05-10",
        auto_renew: false,
    },
];

const dnsRecords = {
    "example-one.com": [
        {
            type: "A",
            name: "@",
            value: "192.0.2.10",
            ttl: 3600,
        },
        {
            type: "CNAME",
            name: "www",
            value: "example-one.com",
            ttl: 3600,
        },
        {
            type: "MX",
            name: "@",
            value: "mail.example-one.com",
            priority: 10,
            ttl: 3600,
        },
    ],
    "example-two.com": [
        {
            type: "A",
            name: "@",
            value: "192.0.2.20",
            ttl: 3600,
        },
        {
            type: "CNAME",
            name: "blog",
            value: "example-two.com",
            ttl: 3600,
        },
    ],
    "expired-demo.com": [
        {
            type: "A",
            name: "@",
            value: "192.0.2.30",
            ttl: 3600,
        },
    ],
};

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

function normalizeDomain(domain) {
    return String(domain || "")
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/\/.*$/, "");
}

function getTools() {
    return [
        {
            name: "list_domains",
            description: "List demo domains. Optionally filter by username or status.",
            inputSchema: {
                type: "object",
                properties: {
                    username: {
                        type: "string",
                        description: "Optional hosting account username filter",
                    },
                    status: {
                        type: "string",
                        description: "Optional domain status filter",
                        enum: ["active", "expired", "suspended"],
                    },
                },
            },
        },
        {
            name: "get_domain_details",
            description: "Get details for a specific domain.",
            inputSchema: {
                type: "object",
                properties: {
                    domain: {
                        type: "string",
                        description: "Domain name",
                    },
                },
                required: ["domain"],
            },
        },
        {
            name: "check_domain_availability",
            description: "Check fake availability for a domain.",
            inputSchema: {
                type: "object",
                properties: {
                    domain: {
                        type: "string",
                        description: "Domain name to check",
                    },
                },
                required: ["domain"],
            },
        },
        {
            name: "list_dns_records",
            description: "List DNS records for a demo domain.",
            inputSchema: {
                type: "object",
                properties: {
                    domain: {
                        type: "string",
                        description: "Domain name",
                    },
                },
                required: ["domain"],
            },
        },
        {
            name: "add_dns_record",
            description: "Add a fake DNS record for a demo domain.",
            inputSchema: {
                type: "object",
                properties: {
                    domain: {
                        type: "string",
                        description: "Domain name",
                    },
                    type: {
                        type: "string",
                        description: "DNS record type",
                        enum: ["A", "AAAA", "CNAME", "MX", "TXT"],
                    },
                    name: {
                        type: "string",
                        description: "DNS record name. Example: @, www, blog",
                    },
                    value: {
                        type: "string",
                        description: "DNS record value",
                    },
                    ttl: {
                        type: "number",
                        description: "TTL in seconds",
                    },
                    priority: {
                        type: "number",
                        description: "Priority for MX records",
                    },
                },
                required: ["domain", "type", "name", "value"],
            },
        },
        {
            name: "update_nameservers",
            description: "Update fake nameservers for a demo domain.",
            inputSchema: {
                type: "object",
                properties: {
                    domain: {
                        type: "string",
                        description: "Domain name",
                    },
                    nameservers: {
                        type: "array",
                        description: "List of nameservers",
                        items: {
                            type: "string",
                        },
                    },
                },
                required: ["domain", "nameservers"],
            },
        },
    ];
}

function callTool(name, args = {}) {
    if (name === "list_domains") {
        let result = [...domains];

        if (args.username) {
            result = result.filter((item) => item.username === args.username);
        }

        if (args.status) {
            result = result.filter((item) => item.status === args.status);
        }

        return toolText(result);
    }

    if (name === "get_domain_details") {
        const domainName = normalizeDomain(args.domain);
        const domain = domains.find((item) => item.domain === domainName);

        if (!domain) {
            return toolText(`No domain found for ${domainName}`, true);
        }

        return toolText({
            ...domain,
            dns_record_count: dnsRecords[domainName]?.length || 0,
        });
    }

    if (name === "check_domain_availability") {
        const domainName = normalizeDomain(args.domain);

        if (!domainName || !domainName.includes(".")) {
            return toolText("Please provide a valid domain name.", true);
        }

        const alreadyExists = domains.some((item) => item.domain === domainName);

        return toolText({
            domain: domainName,
            available: !alreadyExists,
            message: alreadyExists
                ? `${domainName} is already registered in this demo system.`
                : `${domainName} looks available in this fake demo check.`,
        });
    }

    if (name === "list_dns_records") {
        const domainName = normalizeDomain(args.domain);
        const domain = domains.find((item) => item.domain === domainName);

        if (!domain) {
            return toolText(`No domain found for ${domainName}`, true);
        }

        return toolText({
            domain: domainName,
            records: dnsRecords[domainName] || [],
        });
    }

    if (name === "add_dns_record") {
        const domainName = normalizeDomain(args.domain);
        const domain = domains.find((item) => item.domain === domainName);

        if (!domain) {
            return toolText(`No domain found for ${domainName}`, true);
        }

        const allowedTypes = ["A", "AAAA", "CNAME", "MX", "TXT"];
        const recordType = String(args.type || "").toUpperCase();

        if (!allowedTypes.includes(recordType)) {
            return toolText(`DNS record type must be one of: ${allowedTypes.join(", ")}`, true);
        }

        if (!args.name || !args.value) {
            return toolText("name and value are required for DNS record.", true);
        }

        const newRecord = {
            type: recordType,
            name: args.name,
            value: args.value,
            ttl: args.ttl || 3600,
        };

        if (recordType === "MX") {
            newRecord.priority = args.priority || 10;
        }

        if (!dnsRecords[domainName]) {
            dnsRecords[domainName] = [];
        }

        dnsRecords[domainName].push(newRecord);

        return toolText({
            message: "DNS record added",
            domain: domainName,
            record: newRecord,
            records: dnsRecords[domainName],
        });
    }

    if (name === "update_nameservers") {
        const domainName = normalizeDomain(args.domain);
        const domain = domains.find((item) => item.domain === domainName);

        if (!domain) {
            return toolText(`No domain found for ${domainName}`, true);
        }

        if (!Array.isArray(args.nameservers) || args.nameservers.length < 2) {
            return toolText("Please provide at least two nameservers.", true);
        }

        domain.nameservers = args.nameservers;

        return toolText({
            message: "Nameservers updated",
            domain,
        });
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

    if (id === undefined || id === null) {
        return new Response(null, { status: 204 });
    }

    if (method === "initialize") {
        return jsonResponse(
            mcpResult(id, {
                protocolVersion: "2025-03-26",
                capabilities: {
                    tools: {},
                },
                serverInfo: {
                    name: "domain-mcp",
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

    if (method === "prompts/list") {
        return jsonResponse(
            mcpResult(id, {
                prompts: [],
            })
        );
    }

    if (method === "resources/list") {
        return jsonResponse(
            mcpResult(id, {
                resources: [],
            })
        );
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
                name: "domain-mcp",
                status: "ok",
                mcp_endpoint: "/mcp",
                tools: getTools().map((tool) => tool.name),
            });
        }

        if (url.pathname === "/mcp") {
            if (request.method === "GET") {
                return jsonResponse({
                    name: "domain-mcp",
                    status: "ok",
                    transport: "streamable-http",
                    message: "Use POST /mcp for MCP JSON-RPC requests."
                });
            }

            if (request.method !== "POST") {
                return jsonResponse({ error: "Use POST /mcp" }, 405);
            }

            return handleMcpRequest(request);
        }

        return jsonResponse({ error: "Not found" }, 404);
    },
};