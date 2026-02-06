#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import fs from "fs-extra";
import path from "path";
import yaml from "js-yaml";

// Configuration
// If SKILLS_ROOT env var is set, use it. Otherwise try to find 'skills' dir in project root.
// We assume this script is running from mcp-servers/skills-service/src or dist
// So project root is likely ../../..
const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const SKILLS_DIR = process.env.SKILLS_ROOT || path.join(PROJECT_ROOT, "skills");

console.error(`[SkillsService] Skills Directory: ${SKILLS_DIR}`);

interface SkillMetadata {
  name: string;
  description: string;
  version?: string;
  [key: string]: any;
}

interface Skill {
  name: string;
  path: string;
  metadata: SkillMetadata;
  content: string; // The raw markdown content
}

class SkillsServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "skills-service",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error("[SkillsService Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "list_skills",
            description: "List all available skills with their descriptions. Use this to discover what capabilities are available.",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "read_skill",
            description: "Read the full content and instructions of a specific skill. Use this when you decide to use a skill.",
            inputSchema: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "The name of the skill to read (e.g., 'git-commit-helper')",
                },
              },
              required: ["name"],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case "list_skills": {
          const skills = await this.discoverSkills();
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  skills.map((s) => ({
                    name: s.metadata.name || s.name,
                    description: s.metadata.description || "No description provided",
                  })),
                  null,
                  2
                ),
              },
            ],
          };
        }

        case "read_skill": {
          const { name } = request.params.arguments as { name: string };
          const skills = await this.discoverSkills();
          const skill = skills.find((s) => (s.metadata.name === name) || (s.name === name));

          if (!skill) {
            throw new McpError(
              ErrorCode.InvalidParams,
              `Skill '${name}' not found.`
            );
          }

          return {
            content: [
              {
                type: "text",
                text: skill.content,
              },
            ],
          };
        }

        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  private async discoverSkills(): Promise<Skill[]> {
    if (!await fs.pathExists(SKILLS_DIR)) {
        // Create it if it doesn't exist, to avoid errors
        await fs.ensureDir(SKILLS_DIR);
        return [];
    }

    const entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true });
    const skills: Skill[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillPath = path.join(SKILLS_DIR, entry.name, "SKILL.md");
        if (await fs.pathExists(skillPath)) {
          try {
            const content = await fs.readFile(skillPath, "utf-8");
            const parsed = this.parseSkillFile(content);
            skills.push({
              name: parsed.metadata.name || entry.name,
              path: skillPath,
              metadata: parsed.metadata,
              content: content,
            });
          } catch (e) {
            console.error(`Failed to load skill at ${skillPath}:`, e);
          }
        }
      }
    }

    return skills;
  }

  private parseSkillFile(content: string): { metadata: SkillMetadata; body: string } {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (match) {
      try {
        const metadata = yaml.load(match[1]) as SkillMetadata;
        return { metadata, body: match[2] };
      } catch (e) {
        console.error("YAML parse error:", e);
      }
    }
    
    // Fallback if no frontmatter
    return {
      metadata: { name: "", description: "" },
      body: content
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Skills Service MCP server running on stdio");
  }
}

const server = new SkillsServer();
server.run().catch(console.error);
