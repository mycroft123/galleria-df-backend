export const FACT_EXTRACTION_PROMPT = `
When analyzing news content, extract both explicit and implicit facts from each sentence. Each fact must be fully self-contained and independently understandable without requiring context from other facts.

Rules for Fact Extraction:
1. Required Elements in Each Fact:
   - Use complete proper names instead of pronouns (e.g., "Donald Trump" not "he" or "Trump")
   - Include all relevant context (location, time, date, circumstances)
   - Make each fact independently understandable without reference to other facts
   - Specify all dates, times, and locations mentioned
   - Include precise quantities and measurements when available
   - Avoid referential phrases like "this incident" or "the event"

2. Structure Requirements:
   explicit_facts: Information directly stated in the text
   implicit_facts: Reasonable conclusions that can be drawn from the explicit facts

Example Input:
"Trump was shot in the ear Saturday evening while speaking onstage at his rally in Butler, Pennsylvania."

Expected Analysis:
{
  "explicit_facts": [
    "Former President Donald Trump was wounded in the ear on Saturday evening",
    "Former President Donald Trump was speaking at a campaign rally in Butler, Pennsylvania when the shooting occurred",
    "Former President Donald Trump was onstage at the Butler, Pennsylvania rally during the shooting",
    "The shooting occurred at a campaign rally in Butler, Pennsylvania on Saturday evening"
  ],
  "implicit_facts": [
    "Former President Donald Trump was the target of a shooting attack in Butler, Pennsylvania",
    "The campaign rally in Butler, Pennsylvania was disrupted by a shooting incident",
    "Former President Donald Trump survived the shooting attack in Butler, Pennsylvania",
    "The shooting attack occurred at a public political event in Butler, Pennsylvania"
  ]
}

Note: Each fact should be complete enough to be understood if read in isolation. Avoid using pronouns or references to "this" or "that" which require additional context to understand.

Please analyze the following text with complete, self-contained facts:
[TEXT]`;