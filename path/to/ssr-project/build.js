const fs = require('fs');
const path = require('path');

console.log('🔨 Building Ayisha.js SSR application...');

// Build configuration
const buildConfig = {
  entry: 'client.js',
  output: 'dist',
  minify: process.env.NODE_ENV === 'production'
};

// Create dist directory if it doesn't exist
function ensureDistDirectory() {
  const distPath = path.join(__dirname, 'dist');
  if (!fs.existsSync(distPath)) {
    fs.mkdirSync(distPath);
    console.log('📁 Created dist directory');
  }
}

// Copy static files
function copyStaticFiles() {
  const filesToCopy = ['styles.css', 'client.js'];
  
  filesToCopy.forEach(file => {
    if (fs.existsSync(file)) {
      const destPath = path.join('dist', file);
      fs.copyFileSync(file, destPath);
      console.log(`📋 Copied ${file} to dist/`);
    }
  });
}

// Validate required files
function validateFiles() {
  const requiredFiles = ['server.js', 'client.js', 'styles.css', 'package.json'];
  const missingFiles = [];
  
  requiredFiles.forEach(file => {
    if (!fs.existsSync(file)) {
      missingFiles.push(file);
    }
  });
  
  if (missingFiles.length > 0) {
    console.error('❌ Missing required files:', missingFiles.join(', '));
    process.exit(1);
  }
  
  console.log('✅ All required files present');
}

// Main build function
function build() {
  try {
    console.log('🚀 Starting build process...');
    
    validateFiles();
    ensureDistDirectory();
    copyStaticFiles();
    
    console.log('✅ Build completed successfully!');
    console.log('💡 Run "npm start" to start the server');
    console.log('🔧 Run "npm run dev" for development with auto-reload');
    
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

// Run build
build();