const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const { getTemplate } = require('./templates');

async function generateProject(options) {
  const { projectName, template, mode = 'cdn', includeExamples, setupGit } = options;
  const projectPath = path.join(process.cwd(), projectName);

  // Force modern mode for SSR template
  const actualMode = template === 'ssr' ? 'modern' : mode;

  // Check if directory exists
  if (await fs.pathExists(projectPath)) {
    throw new Error(`Directory ${projectName} already exists`);
  }

  // Create project directory
  await fs.ensureDir(projectPath);

  // Copy template files based on mode
  const templateData = getTemplate(template, actualMode);
  await copyTemplate(templateData, projectPath, { projectName, includeExamples });

  // Copy shared assets (CSS and logo) for all templates
  const assetsPath = path.join(__dirname, '../..');
  const stylesSourcePath = path.join(assetsPath, 'styles.css');
  const logoSourcePath = path.join(assetsPath, 'ayisha-logo-black.png');
  
  const stylesDestPath = path.join(projectPath, 'styles.css');
  const logoDestPath = path.join(projectPath, 'ayisha-logo-black.png');

  if (await fs.pathExists(stylesSourcePath)) {
    await fs.copy(stylesSourcePath, stylesDestPath);
  }

  if (await fs.pathExists(logoSourcePath)) {
    await fs.copy(logoSourcePath, logoDestPath);
  }

  // Copy ayisha.js for modern mode - CORRETTO: usa actualMode!
  if (actualMode === 'modern') {
    const ayishaSourcePath = path.join(assetsPath, 'ayisha.js');
    const ayishaDestPath = path.join(projectPath, 'ayisha.js');
    await fs.copy(ayishaSourcePath, ayishaDestPath);
  }

  // Create package.json SOLO se NON è template SSR
  if (template !== 'ssr') {
    await createPackageJson(projectPath, projectName, actualMode, template);
  }

  // Install dependencies for modern mode - CORRETTO: usa actualMode!
  if (actualMode === 'modern') {
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

async function createPackageJson(projectPath, projectName, mode, template) {
  let packageJson;
  
  if (mode === 'modern') {
    // Per template SSR, usa script CommonJS invece di Vite
    if (template === 'ssr') {
      packageJson = {
        name: projectName,
        version: "1.0.0",
        description: "An Ayisha.js SSR application",
        main: "server.js",
        scripts: {
          "start": "node server.js",
          "dev": "nodemon server.js",
          "build": "node build.js",
          "test": "echo \"Error: no test specified\" && exit 1"
        },
        dependencies: {
          "express": "^4.18.2",
          "compression": "^1.7.4",
          "helmet": "^7.0.0"
        },
        devDependencies: {
          "nodemon": "^3.0.1"
        },
        keywords: ["ayisha", "ssr", "javascript", "express"],
        author: "",
        license: "MIT"
      };
      // NON aggiungere "type": "module" per SSR (usa CommonJS)
    } else {
      // Altri template con Vite e ES Modules
      packageJson = {
        name: projectName,
        version: "1.0.0",
        description: "An Ayisha.js application",
        type: "module",
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
    }
  } else {
    // CDN mode (invariato)
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