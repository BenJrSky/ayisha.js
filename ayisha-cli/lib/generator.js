const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const { getTemplate } = require('./templates');

async function generateProject(options) {
  const { projectName, template, mode = 'cdn', includeExamples, setupGit } = options;
  const projectPath = path.join(process.cwd(), projectName);

  // Check if directory exists
  if (await fs.pathExists(projectPath)) {
    throw new Error(`Directory ${projectName} already exists`);
  }

  // Create project directory
  await fs.ensureDir(projectPath);

  // Copy template files based on mode
  const templateData = getTemplate(template, mode);
  await copyTemplate(templateData, projectPath, { projectName, includeExamples });

  // Copy shared assets (CSS and logo) for all templates
  const assetsPath = path.join(__dirname, '../..');
  const stylesSourcePath = path.join(assetsPath, 'styles.css');
  const logoSourcePath = path.join(assetsPath, 'ayisha-logo-black.png');

  // Determine destination paths based on mode
  let stylesDestPath, logoDestPath;
  if (mode === 'modern') {
    // For modern mode, copy to src/ directory
    stylesDestPath = path.join(projectPath, 'src', 'styles.css');
    logoDestPath = path.join(projectPath, 'src', 'ayisha-logo-black.png');
  } else {
    // For CDN mode, copy to root directory
    stylesDestPath = path.join(projectPath, 'styles.css');
    logoDestPath = path.join(projectPath, 'ayisha-logo-black.png');
  }

  await fs.copy(stylesSourcePath, stylesDestPath);
  await fs.copy(logoSourcePath, logoDestPath);

  // Copy ayisha.js for modern mode
  if (mode === 'modern') {
    const ayishaSourcePath = path.join(assetsPath, 'ayisha.js');
    const ayishaDestPath = path.join(projectPath, 'ayisha.js');
    await fs.copy(ayishaSourcePath, ayishaDestPath);
  }

  await createPackageJson(projectPath, projectName, mode, template);

  // Install dependencies for modern mode
  if (mode === 'modern') {
    console.log('Installing dependencies...');
    try {
      execSync('npm install', { cwd: projectPath, stdio: 'inherit' });
    } catch (error) {
      console.warn('Failed to install dependencies. Run "npm install" manually.');
    }
  }

  // Setup git if requested
  if (setupGit) {
    try {
      execSync('git init', { cwd: projectPath, stdio: 'ignore' });
      await fs.writeFile(path.join(projectPath, '.gitignore'), getGitignoreContent(mode));
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

// Modifica alla funzione createPackageJson (righe 89-132)
async function createPackageJson(projectPath, projectName, mode, template) {
  let packageJson;
  
  if (mode === 'modern') {
    packageJson = {
      name: projectName,
      version: "1.0.0",
      description: "An Ayisha.js application",
      main: "src/main.js",
      scripts: {
        "dev": "vite",
        "build": "vite build",
        "preview": "vite preview"
      },
      devDependencies: {
        "vite": "^5.0.0"
      },
      keywords: ["ayisha", "spa", "javascript", "vite"],
      author: "",
      license: "MIT"
    };
    
    // NON aggiungere "type": "module" per i template SSR
    // perché utilizzano CommonJS (require/module.exports)
    if (template !== 'ssr') {
      packageJson.type = "module";
    }
  } else {
    // CDN mode
    packageJson = {
      name: projectName,
      version: "1.0.0",
      description: "An Ayisha.js application",
      main: "index.html",
      scripts: {
        "dev": "npx live-server --port=3000",
        "build": "echo 'No build step needed for Ayisha.js CDN mode'"
      },
      keywords: ["ayisha", "spa", "javascript"],
      author: "",
      license: "MIT"
    };
  }
  
  await fs.writeFile(
    path.join(projectPath, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
}

function getGitignoreContent(mode) {
  const baseContent = `node_modules/\n.DS_Store\n*.log\n.env`;
  
  if (mode === 'modern') {
    return baseContent + `\ndist/\n.vite/`;
  }
  
  return baseContent;
}

module.exports = { generateProject };