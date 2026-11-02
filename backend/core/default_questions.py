# Starter question bank seeded into an empty `questions` table (see core.database.init_db).
# Keys match the roles offered by the candidate frontends. Three questions per difficulty
# covers a full interview, so Company and Hybrid modes work without calling the AI provider.
DEFAULT_QUESTIONS: dict[str, dict[str, list[str]]] = {
    "Frontend Developer": {
        "easy": [
            "Explain the difference between let, const, and var in JavaScript.",
            "What is the CSS box model, and how does box-sizing: border-box change it?",
            "How does event bubbling work in the DOM, and how would you stop an event from propagating?",
        ],
        "medium": [
            "How does React decide when to re-render a component, and how can you avoid unnecessary re-renders?",
            "Explain the JavaScript event loop, including the difference between microtasks and macrotasks.",
            "How would you make a web page accessible to keyboard and screen-reader users?",
        ],
        "hard": [
            "How would you diagnose and fix a slow Largest Contentful Paint on a production React app?",
            "Design state management for a large single-page app with real-time updates. Which trade-offs matter?",
            "Explain how server-side rendering and hydration work, and what causes hydration mismatches.",
        ],
    },
    "Backend Developer": {
        "easy": [
            "What is the difference between GET, POST, PUT, PATCH, and DELETE in a REST API?",
            "What is a database index, and when can adding one hurt performance?",
            "Explain the difference between authentication and authorization.",
        ],
        "medium": [
            "How would you design rate limiting for a public API?",
            "Explain database transactions and the ACID properties with an example.",
            "How would you handle retries and idempotency when calling an unreliable third-party API?",
        ],
        "hard": [
            "Design a URL shortener that serves millions of requests per day. Cover storage, caching, and scaling.",
            "How would you change the schema of a large production table with zero downtime?",
            "How would you find and fix a memory leak or latency spike in a production service?",
        ],
    },
    "Full Stack Engineer": {
        "easy": [
            "Walk through what happens between typing a URL into the browser and the page being displayed.",
            "What is CORS, and why does the browser enforce it?",
            "How would you store user passwords securely?",
        ],
        "medium": [
            "How would you design authentication for a web app with a separate frontend and API? Compare sessions and JWTs.",
            "How would you implement pagination for a large list, in both the API and the UI?",
            "How would you set up a CI/CD pipeline for a full-stack application?",
        ],
        "hard": [
            "Design a real-time collaborative feature such as live comments, end to end. How do you keep clients in sync?",
            "How would you scale a full-stack application whose database has become the bottleneck?",
            "Design uploads for very large files, covering the client, the API, and storage.",
        ],
    },
    "AI / ML Engineer": {
        "easy": [
            "What is the difference between supervised and unsupervised learning? Give an example of each.",
            "What is overfitting, and how can you prevent it?",
            "Explain precision and recall, and when you would prioritize each.",
        ],
        "medium": [
            "Explain how Retrieval-Augmented Generation works and when you would choose it over fine-tuning.",
            "How do embeddings work, and how would you choose a similarity metric for semantic search?",
            "How would you evaluate the quality of an LLM-powered feature before shipping it?",
        ],
        "hard": [
            "Design a production RAG system over millions of documents. How do you handle chunking, retrieval quality, and latency?",
            "How would you reduce the cost and latency of serving an LLM application at scale?",
            "How would you detect and respond to data drift for a model in production?",
        ],
    },
}
