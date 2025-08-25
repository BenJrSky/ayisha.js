const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const { getTemplate } = require('./templates');

async function generateProject(options) {
  const { projectName, template, includeExamples, setupGit } = options;
  const projectPath = path.join(process.cwd(), projectName);

  // Check if directory exists
  if (await fs.pathExists(projectPath)) {
    throw new Error(`Directory ${projectName} already exists`);
  }

  // Create project directory
  await fs.ensureDir(projectPath);

  // Copy template files
  const templateData = getTemplate(template);
  await copyTemplate(templateData, projectPath, { projectName, includeExamples });

  // Create package.json
  await createPackageJson(projectPath, projectName);

  // Setup git if requested
  if (setupGit) {
    try {
      execSync('git init', { cwd: projectPath, stdio: 'ignore' });
      await fs.writeFile(path.join(projectPath, '.gitignore'), gitignoreContent);
    } catch (error) {
      // Git not available, skip
    }
  }
}

async function copyTemplate(templateData, projectPath, variables) {
  for (const [filePath, content] of Object.entries(templateData.files)) {
    const fullPath = path.join(projectPath, filePath);
    await fs.ensureDir(path.dirname(fullPath));
    
    // Replace variables in content
    let processedContent = content;
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processedContent = processedContent.replace(regex, value);
    });
    
    await fs.writeFile(fullPath, processedContent);
  }
}

async function createPackageJson(projectPath, projectName) {
  const packageJson = {
    name: projectName,
    version: "1.0.0",
    description: "An Ayisha.js application",
    main: "index.html",
    scripts: {
      "dev": "npx live-server --port=3000",
      "build": "echo 'No build step needed for Ayisha.js'"
    },
    keywords: ["ayisha", "spa", "javascript"],
    author: "",
    license: "MIT"
  };
  
  await fs.writeFile(
    path.join(projectPath, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
}

const gitignoreContent = `
node_modules/
.DS_Store
*.log
dist/
.env
`;

module.exports = { generateProject };