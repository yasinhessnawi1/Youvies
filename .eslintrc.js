// Set BABEL_ENV/NODE_ENV before babel-preset-react-app is loaded
if (!process.env.BABEL_ENV && !process.env.NODE_ENV) {
  process.env.BABEL_ENV = 'development';
  process.env.NODE_ENV = 'development';
}

module.exports = {
  extends: ['react-app', 'react-app/jest'],
  env: {
    browser: true,
    node: true,
    es2021: true
  },
  settings: {
    react: {
      version: 'detect'
    }
  }
};
