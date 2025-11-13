const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const cookieSession = require('cookie-session');

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// --- Middleware Setup ---
app.set('view engine', 'ejs');
app.use(express.static('public')); // For accessing style.css
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieSession({
    name: 'session',
    keys: [process.env.SESSION_SECRET],
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
}));

// --- Database Connection ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB Connected Successfully!'))
    .catch(err => console.error('MongoDB Connection Error:', err));

// --- Mongoose Schema ---
const newsPostSchema = new mongoose.Schema({
    title: String,
    imageUrl: String,
    content: String,
    date: { type: Date, default: Date.now }
});

const NewsPost = mongoose.model('NewsPost', newsPostSchema);

// --- Admin Authentication Middleware ---
const requireAdmin = (req, res, next) => {
    if (!req.session.isAdmin) {
        return res.redirect('/admin/login');
    }
    next();
};

// --- ROUTES ---

// 1. HOME PAGE (Display all posts)
app.get('/', async (req, res) => {
    try {
        const posts = await NewsPost.find().sort({ date: -1 });
        // The 'posts' array is passed to the index.ejs template
        res.render('index', { posts: posts });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading posts.');
    }
});

// 2. ADMIN LOGIN (GET)
app.get('/admin/login', (req, res) => {
    res.render('login', { error: null });
});

// 3. ADMIN LOGIN (POST)
app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    
    // Simple check against .env variables
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        return res.redirect('/admin/dashboard');
    }
    res.render('login', { error: 'Invalid Credentials. Use: admin / 12345' });
});

// 4. ADMIN DASHBOARD (View Add/Manage page)
app.get('/admin/dashboard', requireAdmin, async (req, res) => {
    try {
        const posts = await NewsPost.find().sort({ date: -1 });
        res.render('admin', { posts: posts, format: (date) => new Date(date).toLocaleString('en-GB') });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading dashboard.');
    }
});

// 5. ADD NEW POST (POST) - Saves data permanently to MongoDB Atlas
app.post('/admin/add-post', requireAdmin, async (req, res) => {
    const { title, imageUrl, content } = req.body;
    try {
        const newPost = new NewsPost({
            title,
            imageUrl: imageUrl || '', // Use empty string if no image URL is provided
            content
        });
        await newPost.save();
        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error creating post.');
    }
});

// 6. MANAGE POSTS (DELETE)
app.post('/admin/delete-post/:id', requireAdmin, async (req, res) => {
    try {
        await NewsPost.findByIdAndDelete(req.params.id);
        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error deleting post.');
    }
});

// 7. ADMIN LOGOUT
app.get('/admin/logout', (req, res) => {
    req.session = null;
    res.redirect('/');
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});