module.exports = {
  env: {
    browser: true
  },
  extends: ["airbnb-base"],
  plugins: ["react"],
  parserOptions: {
    ecmaFeatures: {
      jsx: true
    }
  },
  globals: {
    chrome: false
  }
};
