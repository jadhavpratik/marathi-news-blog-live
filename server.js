const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const cookieSession = require('cookie-session');
const multer = require('multer');
const path = require('path'); // Added path module for better path handling

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// --- Middleware Setup ---
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files
app.use(bodyParser.urlencoded({ extended: true }));
// NOTE: bodyParser must be placed before Multer to handle non-file data efficiently, 
// but Multer handles form data when files are present.

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

// --- Multer Configuration for File Uploads ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Use path.join to ensure correct path regardless of OS
        cb(null, path.join(__dirname, 'public', 'uploads')); 
    },
    filename: function (req, file, cb) {
        // Create unique file name
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// Tell Express to serve files from the 'uploads' folder publicly
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// --- ROUTES ---

// 1. HOME PAGE (Display all posts)
app.get('/', async (req, res) => {
    try {
        const posts = await NewsPost.find().sort({ date: -1 });
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
    
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        return res.redirect('/admin/dashboard');
    }
    res.render('login', { error: 'Invalid Credentials.' });
});

// 4. ADMIN DASHBOARD (View Add/Manage page)
app.get('/admin/dashboard', requireAdmin, async (req, res) => {
    try {
        const posts = await NewsPost.find().sort({ date: -1 }); // <--- THIS QUERY is run
        res.render('admin', { posts: posts, format: (date) => new Date(date).toLocaleString('en-GB') });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading dashboard.');
    }
});

// 5. ADD NEW POST (POST) - CORRECTED ROUTE (Only one instance)
app.post('/admin/add-post', requireAdmin, upload.single('imageFile'), async (req, res) => {
    // Multer populates req.body with text fields (title, content, imageUrl)
    const { title, content } = req.body; 
    let imageUrl = req.body.imageUrl || ''; 

    // If a file was uploaded, use the server path
    if (req.file) {
        // Save the public path (relative to the /uploads alias)
        imageUrl = '/uploads/' + req.file.filename; 
    }
    
    if (!title || !content) {
        console.error("Missing title or content in request body.");
        return res.status(400).send("Title and Content are required.");
    }
    
    try {
        const newPost = new NewsPost({
            title,
            imageUrl: imageUrl, 
            content
        });
        await newPost.save(); // Save to MongoDB
        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error("Database Save Error:", err);
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