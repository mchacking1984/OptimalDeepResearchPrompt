// Vercel Serverless Function for Gemini API calls
// Environment variable GEMINI_API_KEY must be set in Vercel dashboard

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent';

// Model configurations with transformation instructions
const modelConfigs = {
    openai: {
        name: "OpenAI o3-DR",
        instructions: `Transform the user's raw research prompt into an optimized prompt for OpenAI's o3-DR model (Deep Research mode).

Key transformation principles for OpenAI o3-DR:
1. RECURSIVE LOGIC: Force decomposition into sub-questions and research trees
2. PRIMARY SOURCE PRIORITIZATION: Mandate verification of primary data sources
3. LOGIC CHAIN REQUIREMENT: Require explicit reasoning chains
4. CONFLICT RESOLUTION: Include protocols for handling contradictory information

The output prompt should:
- Begin with a structured research protocol
- Include phases for: Research Tree Construction, Source Hierarchy Protocol, Conflict Resolution
- Require the model to outline its research tree BEFORE searching
- Mandate that aggregator sources be traced to primary data
- Include output requirements for source verification logs and confidence ratings
- Use markdown formatting with clear headers and bullet points`
    },
    gemini: {
        name: "Gemini 3.0",
        instructions: `Transform the user's raw research prompt into an optimized prompt for Google Gemini 3.0's Deep Research capabilities.

Key transformation principles for Gemini 3.0:
1. GLASS-BOX CONTROL: Enable transparent, step-by-step research planning
2. PAUSE-FOR-REVIEW FLAGS: Include explicit pause points for user confirmation
3. MULTI-SOURCE INTEGRATION: Link web search with internal file/workspace context
4. 1M TOKEN WINDOW UTILIZATION: Encourage ingesting full documents, not snippets

The output prompt should:
- Start with "Draft a research plan first and pause for confirmation"
- Include numbered steps with explicit PAUSE instructions
- Reference potential internal files/documents integration
- Emphasize using full context window for complete PDF ingestion
- Include a source matrix (internal vs external) in deliverables
- Request date-stamped citations for real-time data
- Use clear step-by-step formatting`
    },
    claude: {
        name: "Claude 4.5",
        instructions: `Transform the user's raw research prompt into an optimized prompt for Anthropic Claude 4.5.

Key transformation principles for Claude 4.5:
1. XML STRUCTURAL TAGS: Wrap content in semantic tags like <instructions>, <context>, <query>, <output_format>
2. ANTI-SYCOPHANCY: Explicitly instruct to highlight contradictory evidence
3. CITATION FIDELITY: Mandate APA 7th edition format
4. PROSE QUALITY: Emphasize clear, precise academic prose

The output prompt should:
- Use XML tags to structure the prompt (<instructions>, <context>, <query>, <output_format>)
- Include explicit instruction: "If evidence contradicts my premise, highlight it immediately"
- Specify APA citation requirements
- Request distinction between well-established, emerging, and contested findings
- Include structured output format with Executive Summary, Methodology, Key Findings, etc.
- Maintain formal but clear tone`
    },
    deepseek: {
        name: "DeepSeek R1",
        instructions: `Transform the user's raw research prompt into an optimized prompt for DeepSeek R1.

Key transformation principles for DeepSeek R1:
1. FIRST-PRINCIPLES REASONING: Trigger Chain-of-Thought from base truths
2. THOUGHT TRACE REQUIREMENT: Demand visible internal monologue/reasoning
3. QUANTITATIVE VERIFICATION: Mandate cross-verification of ALL numerical data
4. HALLUCINATION PREVENTION: Include explicit protocols to prevent reasoning errors

The output prompt should:
- Begin with "Use first-principles reasoning"
- Require showing complete thought trace for each finding
- Include quantitative verification mandate with independent dataset cross-checking
- Add "UNVERIFIED" flagging protocol for uncertain facts
- Request Foundational Assumptions, Thought Trace Log, Findings Matrix
- Include Quantitative Data Table with verification status
- Emphasize logical consistency checks`
    },
    qwen: {
        name: "Qwen DeepResearch",
        instructions: `Transform the user's raw research prompt into an optimized prompt for Qwen DeepResearch.

Key transformation principles for Qwen DeepResearch:
1. SCALE & VOLUME: Request exhaustive word counts (5,000+ words)
2. ADVANCED MODE TRIGGER: Include "/think" prefix to activate deep reasoning
3. TEMPERATURE CONTROL: Specify Temperature 0.6 to avoid loops while maintaining creativity
4. MULTI-FORMAT OUTPUT: Request multiple deliverable formats (report, briefing, podcast script)

The output prompt should:
- Start with "/think Activate Advanced Research Mode"
- Specify target length of 5,000+ words minimum
- Include generation parameters (Temperature 0.6, avoid greedy decoding)
- Request EXHAUSTIVE coverage with 8+ specific scope areas
- Include three deliverables: Comprehensive Report (4000+ words), Executive Briefing (500 words), Podcast Script Summary (500 words)
- Add quality controls for cross-referencing and confidence levels`
    }
};

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Check for API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({
            error: 'GEMINI_API_KEY environment variable is not configured'
        });
    }

    try {
        const { rawPrompt, model } = req.body;

        // Validate input
        if (!rawPrompt || typeof rawPrompt !== 'string') {
            return res.status(400).json({ error: 'rawPrompt is required' });
        }

        if (!model || !modelConfigs[model]) {
            return res.status(400).json({
                error: 'Invalid model. Must be one of: openai, gemini, claude, deepseek, qwen'
            });
        }

        const config = modelConfigs[model];

        // Build the prompt for Gemini
        const systemPrompt = `You are an expert prompt engineer specializing in optimizing research prompts for different AI models. Your task is to transform a raw research intent into a highly optimized prompt specifically designed for ${config.name}.

${config.instructions}

IMPORTANT RULES:
1. Output ONLY the transformed prompt - no explanations, no preamble, no meta-commentary
2. The output should be ready to copy-paste directly into ${config.name}
3. Maintain the user's original research intent while adding model-specific optimizations
4. Use appropriate formatting (markdown, XML tags, etc.) as specified in the instructions`;

        const requestBody = {
            contents: [{
                parts: [{
                    text: `${systemPrompt}\n\n---\n\nRAW RESEARCH PROMPT TO TRANSFORM:\n${rawPrompt}`
                }]
            }],
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 4096,
            }
        };

        // Call Gemini API
        const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            return res.status(response.status).json({
                error: errorData.error?.message || `Gemini API error: ${response.status}`
            });
        }

        const data = await response.json();

        if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
            return res.status(200).json({
                result: data.candidates[0].content.parts[0].text
            });
        }

        return res.status(500).json({ error: 'Unexpected response format from Gemini API' });

    } catch (error) {
        console.error('Error in generate API:', error);
        return res.status(500).json({
            error: error.message || 'Internal server error'
        });
    }
}
