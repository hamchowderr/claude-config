#!/usr/bin/env node
/**
 * enrich-session.mjs
 *
 * Reads a JSONL conversation transcript and outputs a structured summary.
 * Used by enrichment agents to generate better session summaries.
 *
 * Usage:
 *   node enrich-session.mjs <jsonl-path> [--max-lines 200]
 *
 * Output: JSON with { goal, summary, sessionType }
 */

import { createReadStream } from 'fs';
import { createInterface } from 'readline';

const jsonlPath = process.argv[2];
const maxLines = parseInt(process.argv[3] === '--max-lines' ? process.argv[4] : '200') || 200;

if (!jsonlPath) {
  console.error('Usage: node enrich-session.mjs <jsonl-path> [--max-lines N]');
  process.exit(1);
}

const rl = createInterface({
  input: createReadStream(jsonlPath, { encoding: 'utf-8' }),
  crlfDelay: Infinity,
});

let lineNum = 0;
const messages = [];

for await (const line of rl) {
  lineNum++;
  if (lineNum > maxLines * 3) break; // read more lines to find enough messages

  try {
    const obj = JSON.parse(line);
    if ((obj.type === 'user' || obj.type === 'assistant') && obj.isMeta !== true) {
      const role = obj.message?.role || obj.type;
      let content = '';
      if (typeof obj.message?.content === 'string') {
        content = obj.message.content;
      } else if (Array.isArray(obj.message?.content)) {
        content = obj.message.content
          .filter(c => c.type === 'text')
          .map(c => c.text)
          .join('\n');
      }

      // Clean ANSI codes and XML tags
      content = content
        .replace(/\x1b\[[0-9;]*m/g, '')
        .replace(/\[(?:\d+;)*\d*m/g, '')
        .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
        .replace(/<[^>]+>/g, '')
        .trim();

      if (content.length > 5 && messages.length < maxLines) {
        messages.push({
          role,
          content: content.substring(0, 500), // cap per-message length
        });
      }
    }
  } catch (e) {}
}

// Output conversation for the agent to summarize
console.log(JSON.stringify({
  totalLines: lineNum,
  messageCount: messages.length,
  messages: messages.slice(0, 60), // cap at 60 messages
}, null, 2));
