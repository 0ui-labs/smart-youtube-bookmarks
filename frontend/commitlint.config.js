export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat", // New feature
        "fix", // Bug fix
        "docs", // Documentation
        "style", // Formatting
        "refactor", // Code restructuring
        "perf", // Performance
        "test", // Tests
        "chore", // Maintenance
        "ci", // CI/CD
        "build", // Build system
        "revert", // Revert commit
      ],
    ],
  },
};
