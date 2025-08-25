const templates = {
  basic: {
    name: 'Basic Template',
    files: {
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{projectName}} - Ayisha.js App</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <init>
            title = '{{projectName}}';
            count = 0;
            message = 'Welcome to Ayisha.js!';
            items = ['Learn Ayisha.js', 'Build amazing apps', 'Deploy to production'];
        </init>
        
        <header>
            <h1>{{ title }}</h1>
            <p>{{ message }}</p>
        </header>
        
        <main>
            <section class="counter">
                <h2>Counter Example</h2>
                <button @click="count++" class="btn">Count: {{ count }}</button>
                <button @click="count = 0" class="btn secondary">Reset</button>
            </section>
            
            <section class="todo">
                <h2>Todo List</h2>
                <ul>
                    <li @for="item in items" @key="$index">
                        {{ item }}
                    </li>
                </ul>
            </section>
            
            <section class="input">
                <h2>Two-way Binding</h2>
                <input @model="message" placeholder="Type something...">
                <p>You typed: <strong>{{ message }}</strong></p>
            </section>
        </main>
    </div>
    
    <script src="https://cdn.jsdelivr.net/gh/BenJrSky/ayisha.js@main/dist/ayisha-1.0.4-min.js"></script>
</body>
</html>`,
      'style.css': `* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: #333;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
}

.container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
}

header {
    text-align: center;
    margin-bottom: 3rem;
    color: white;
}

header h1 {
    font-size: 3rem;
    margin-bottom: 0.5rem;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}

main {
    background: white;
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
}

section {
    margin-bottom: 2rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid #eee;
}

section:last-child {
    border-bottom: none;
    margin-bottom: 0;
}

h2 {
    color: #667eea;
    margin-bottom: 1rem;
}

.btn {
    background: #667eea;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
    margin-right: 0.5rem;
    transition: all 0.3s ease;
}

.btn:hover {
    background: #5a6fd8;
    transform: translateY(-2px);
}

.btn.secondary {
    background: #6c757d;
}

.btn.secondary:hover {
    background: #5a6268;
}

input {
    width: 100%;
    padding: 0.75rem;
    border: 2px solid #ddd;
    border-radius: 6px;
    font-size: 1rem;
    margin-bottom: 1rem;
}

input:focus {
    outline: none;
    border-color: #667eea;
}

ul {
    list-style: none;
}

li {
    background: #f8f9fa;
    padding: 0.75rem;
    margin-bottom: 0.5rem;
    border-radius: 6px;
    border-left: 4px solid #667eea;
}`
    }
  },
  
  spa: {
    name: 'SPA Template',
    files: {
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{projectName}} - SPA</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="app">
        <init>
            currentUser = { name: 'Guest', loggedIn: false };
            products = [
                { id: 1, name: 'Product 1', price: 29.99 },
                { id: 2, name: 'Product 2', price: 39.99 },
                { id: 3, name: 'Product 3', price: 19.99 }
            ];
        </init>
        
        <nav class="navbar">
            <div class="nav-brand">
                <h1>{{projectName}}</h1>
            </div>
            <div class="nav-links">
                <a @link="home" class="nav-link">Home</a>
                <a @link="products" class="nav-link">Products</a>
                <a @link="about" class="nav-link">About</a>
                <a @link="contact" class="nav-link">Contact</a>
            </div>
        </nav>
        
        <main class="main-content">
            <!-- Home Page -->
            <div @page="home" class="page">
                <component @src="./pages/home.html"></component>
            </div>
            
            <!-- Products Page -->
            <div @page="products" class="page">
                <component @src="./pages/products.html"></component>
            </div>
            
            <!-- About Page -->
            <div @page="about" class="page">
                <component @src="./pages/about.html"></component>
            </div>
            
            <!-- Contact Page -->
            <div @page="contact" class="page">
                <component @src="./pages/contact.html"></component>
            </div>
        </main>
    </div>
    
    <script src="https://cdn.jsdelivr.net/gh/BenJrSky/ayisha.js@main/dist/ayisha-1.0.4-min.js"></script>
</body>
</html>`,
      'style.css': `/* SPA Styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: #333;
}

.navbar {
    background: #2c3e50;
    color: white;
    padding: 1rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.nav-brand h1 {
    font-size: 1.5rem;
}

.nav-links {
    display: flex;
    gap: 2rem;
}

.nav-link {
    color: white;
    text-decoration: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    transition: background 0.3s;
}

.nav-link:hover {
    background: rgba(255,255,255,0.1);
}

.main-content {
    padding: 2rem;
    min-height: calc(100vh - 80px);
}

.page {
    max-width: 1200px;
    margin: 0 auto;
}

.fadeIn {
    animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}`,
      'pages/home.html': `<div class="home-page fadeIn">
    <header class="hero">
        <h1>Welcome to {{projectName}}</h1>
        <p>A modern SPA built with Ayisha.js</p>
        <button @click="_currentPage='products'" class="cta-btn">View Products</button>
    </header>
    
    <section class="features">
        <div class="feature">
            <h3>🚀 Fast</h3>
            <p>Lightning fast Virtual DOM</p>
        </div>
        <div class="feature">
            <h3>📱 Responsive</h3>
            <p>Works on all devices</p>
        </div>
        <div class="feature">
            <h3>🎯 Simple</h3>
            <p>Easy to learn and use</p>
        </div>
    </section>
</div>

<style>
.hero {
    text-align: center;
    padding: 4rem 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 12px;
    margin-bottom: 3rem;
}

.hero h1 {
    font-size: 3rem;
    margin-bottom: 1rem;
}

.cta-btn {
    background: white;
    color: #667eea;
    border: none;
    padding: 1rem 2rem;
    border-radius: 6px;
    font-size: 1.1rem;
    cursor: pointer;
    margin-top: 1rem;
    transition: transform 0.3s;
}

.cta-btn:hover {
    transform: translateY(-2px);
}

.features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 2rem;
}

.feature {
    text-align: center;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
}
</style>`,
      'pages/products.html': `<div class="products-page fadeIn">
    <h1>Our Products</h1>
    
    <div class="products-grid">
        <div @for="product in products" @key="product.id" class="product-card">
            <h3>{{ product.name }}</h3>
            <p class="price">{{ product.price }}</p>
            <button @click="alert('Added ' + product.name + ' to cart!')" class="add-btn">
                Add to Cart
            </button>
        </div>
    </div>
</div>

<style>
.products-page h1 {
    text-align: center;
    margin-bottom: 2rem;
    color: #2c3e50;
}

.products-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
}

.product-card {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    text-align: center;
    transition: transform 0.3s;
}

.product-card:hover {
    transform: translateY(-5px);
}

.price {
    font-size: 1.5rem;
    color: #27ae60;
    font-weight: bold;
    margin: 1rem 0;
}

.add-btn {
    background: #3498db;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.3s;
}

.add-btn:hover {
    background: #2980b9;
}
</style>`,
      'pages/about.html': `<div class="about-page fadeIn">
    <h1>About Us</h1>
    
    <div class="about-content">
        <p>We are a modern company building amazing web applications with cutting-edge technology.</p>
        
        <h2>Our Mission</h2>
        <p>To create beautiful, fast, and user-friendly web applications that make a difference.</p>
        
        <h2>Technologies We Use</h2>
        <ul>
            <li>Ayisha.js - Our framework of choice</li>
            <li>Modern CSS - For beautiful designs</li>
            <li>Progressive Web Apps - For better user experience</li>
        </ul>
    </div>
</div>

<style>
.about-page {
    max-width: 800px;
    margin: 0 auto;
}

.about-page h1 {
    text-align: center;
    margin-bottom: 2rem;
    color: #2c3e50;
}

.about-content {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    line-height: 1.8;
}

.about-content h2 {
    color: #3498db;
    margin: 2rem 0 1rem 0;
}

.about-content ul {
    margin-left: 2rem;
}

.about-content li {
    margin-bottom: 0.5rem;
}
</style>`,
      'pages/contact.html': `<div class="contact-page fadeIn">
    <h1>Contact Us</h1>
    
    <div class="contact-form">
        <init>
            contactForm = { name: '', email: '', message: '' };
            submitted = false;
        </init>
        
        <form @form @result="submitted = true">
            <div class="form-group">
                <label>Name</label>
                <input @model="contactForm.name" @validate="required" type="text" placeholder="Your name">
            </div>
            
            <div class="form-group">
                <label>Email</label>
                <input @model="contactForm.email" @validate="required,email" type="email" placeholder="your@email.com">
            </div>
            
            <div class="form-group">
                <label>Message</label>
                <textarea @model="contactForm.message" @validate="required,minLength:10" placeholder="Your message..."></textarea>
            </div>
            
            <button type="submit" class="submit-btn">Send Message</button>
        </form>
        
        <div @if="submitted" class="success-message">
            <h3>✅ Message Sent!</h3>
            <p>Thank you for contacting us. We'll get back to you soon.</p>
        </div>
    </div>
</div>

<style>
.contact-page {
    max-width: 600px;
    margin: 0 auto;
}

.contact-page h1 {
    text-align: center;
    margin-bottom: 2rem;
    color: #2c3e50;
}

.contact-form {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
}

.form-group {
    margin-bottom: 1.5rem;
}

.form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: bold;
    color: #2c3e50;
}

.form-group input,
.form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border: 2px solid #ddd;
    border-radius: 6px;
    font-size: 1rem;
}

.form-group textarea {
    height: 120px;
    resize: vertical;
}

.form-group input:focus,
.form-group textarea:focus {
    outline: none;
    border-color: #3498db;
}

.submit-btn {
    background: #27ae60;
    color: white;
    border: none;
    padding: 1rem 2rem;
    border-radius: 6px;
    font-size: 1rem;
    cursor: pointer;
    width: 100%;
    transition: background 0.3s;
}

.submit-btn:hover {
    background: #219a52;
}

.success-message {
    background: #d4edda;
    color: #155724;
    padding: 1rem;
    border-radius: 6px;
    margin-top: 1rem;
    text-align: center;
}
</style>`
    }
  }
};

function getTemplate(templateName) {
  return templates[templateName] || templates.basic;
}

function getTemplates() {
  return Object.keys(templates);
}

module.exports = { getTemplate, getTemplates };