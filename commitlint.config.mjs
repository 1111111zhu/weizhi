export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "header-max-length": [0],
    "subject-case": [0],
    "subject-full-stop": [0],
    "subject-max-length": [2, "always", 50],
  },
};
