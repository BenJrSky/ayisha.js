// Client-side hydration and interactivity
document.addEventListener('DOMContentLoaded', function() {
  console.log('🎯 Client-side hydration started');
  
  // Initialize Ayisha.js if available
  if (typeof Ayisha !== 'undefined') {
    console.log('✅ Ayisha.js loaded successfully');
    
    // Example: Add some client-side interactivity
    const app = document.getElementById('app');
    if (app) {
      // Add click handler for demonstration
      app.addEventListener('click', function(e) {
        if (e.target.tagName === 'LI') {
          e.target.style.color = e.target.style.color === 'blue' ? '' : 'blue';
        }
      });
      
      // Add a dynamic timestamp update
      const statusDiv = app.querySelector('.status');
      if (statusDiv) {
        const updateTime = document.createElement('p');
        updateTime.innerHTML = `Client hydrated at: ${new Date().toISOString()}`;
        statusDiv.appendChild(updateTime);
      }
    }
  } else {
    console.warn('⚠️ Ayisha.js not found, falling back to vanilla JS');
  }
  
  console.log('✨ Client-side hydration completed');
});

// Hot reload for development
if (window.location.hostname === 'localhost') {
  console.log('🔄 Development mode: Hot reload active');
}