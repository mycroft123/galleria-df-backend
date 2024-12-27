interface Fact {
    content: string;
    source?: string;
    category?: string;
}

export function isValidFact(fact: unknown): fact is Fact {
    if (!fact || typeof fact !== 'object') {
        return false;
    }

    const typedFact = fact as Fact;

    // Content is required and must be a non-empty string
    if (!typedFact.content || typeof typedFact.content !== 'string' || typedFact.content.trim().length === 0) {
        return false;
    }

    // Source is optional but must be a non-empty string if provided
    if (typedFact.source !== undefined && (typeof typedFact.source !== 'string' || typedFact.source.trim().length === 0)) {
        return false;
    }

    // Category is optional but must be a non-empty string if provided
    if (typedFact.category !== undefined && (typeof typedFact.category !== 'string' || typedFact.category.trim().length === 0)) {
        return false;
    }

    return true;
}

// Example usage:
// const validFact = { content: "The sky is blue", source: "observation" };
// const invalidFact = { content: "" };
// console.log(isValidFact(validFact)); // true
// console.log(isValidFact(invalidFact)); // false