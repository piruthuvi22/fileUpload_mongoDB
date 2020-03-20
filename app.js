const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');
const multer = require('multer');
const GridFsStorage = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');
const methodOverride = require('method-override');

const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.set('view engine', 'ejs');

// Mongo URI
const mongoURI = 'mongodb://localhost:27017/fileU';

// Create mongo connection
const conn = mongoose.createConnection(mongoURI, { useUnifiedTopology: true, useNewUrlParser: true });

// Init gfs
let gfs;

conn.once('open', () => {
    // Init stream
    gfs = Grid(conn.db, mongoose.mongo);
    gfs.collection('pdf');
});

// Create storage engine
const storage = new GridFsStorage({
    url: mongoURI,
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            const filename = file.originalname;
            const other = [req.body.title, req.body.description];
            const fileInfo = {
                filename: filename,
                bucketName: 'pdf',
                metadata: req.body
            };
            resolve(fileInfo, other);
        });
    }
});

const upload = multer({ storage });

// POST
app.post('/upload', upload.single('file'), (req, res) => {

    console.log("title :"+req.body.title);
    console.log("desc :"+req.body.description);
    
    res.redirect('/');
});

// GET data
app.get('/', (req, res) => {
    gfs.files.find().toArray((err, files) => {
        // Check if files
        if (!files || files.length === 0) {
            res.render('pdf', { files: false });
        } else {
            files.map(file => {
                if (
                    file.contentType === 'image/jpeg' ||
                    file.contentType === 'image/png'
                ) {
                    file.isImage = true;
                } else {
                    file.isImage = false;
                }
            });
            res.render('pdf', { files: files });
        }
    });
});



app.get('/files/:filename', (req, res) => {
    gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
        // Check if file
        if (!file || file.length === 0) {
            return res.status(404).json({
                err: 'No file exists'
            });
        }
        // If File exists this will get executed
        const readstream = gfs.createReadStream(file.filename);
        return readstream.pipe(res);
    });
});



// Check if the input is a valid image or not
app.get('/image/:filename', (req, res) => {
    gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
        // Check if the input is a valid image or not
        if (!file || file.length === 0) {
            return res.status(404).json({
                err: 'No file exists'
            });
        }

        // If the file exists then check whether it is an image
        if (file.contentType === 'image/jpeg' || file.contentType === 'image/png') {
            // Read output to browser
            const readstream = gfs.createReadStream(file.filename);
            readstream.pipe(res);
        } else {
            res.status(404).json({
                err: 'Not an image'
            });
        }
    });
});

// delete function to remove the file from the database
app.delete('/files/:id', (req, res) => {
    gfs.remove({ _id: req.params.id, root: 'pdf' }, (err, gridStore) => {
        if (err) {
            return res.status(404).json({ err: err });
        }

        res.redirect('/');
    });
});


const port = 5000;
app.listen(port, () => console.log(`Server started on port ${port}`));