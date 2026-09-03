import express from "express";
import OpenAI from "openai";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const mcpServer = new McpServer({
  name: "openai-claude-mcp",
  version: "1.0.0"
});

mcpServer.registerTool(
  "ask_openai",
  {
    title: "Ask OpenAI",
    description: "Send a prompt to an OpenAI GPT model and return the answer.",
    inputSchema: {
      prompt: z.string().describe("The prompt to send to OpenAI")
    }
  },
  async ({ prompt }) => {
    try {
      const response = await openai.responses.create({
        model: process.env.OPENAI_MODEL || "gpt-5",
        input: prompt
      });

      return {
        content: [
          {
            type: "text",
            text: response.output_text
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `OpenAI error: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }
);

app.post("/mcp", async (req, res) => {
  const secret = process.env.MCP_SECRET;
const auth = req.headers.authorization;

if (!secret || auth !== `Bearer ${secret}`) {
  return res.status(401).json({
    error: "Unauthorized"
  });
}

  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });

    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error(error);

    if (!res.headersSent) {
      res.status(500).json({
        error: "MCP server error"
      });
    }
  }
});

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

const port = Number(process.env.PORT) || 3000;

app.listen(port, "0.0.0.0", () => {
  console.log(`OpenAI MCP server running on port ${port}`);
});
