const express = require('express');
const path = require('path');
const { initDB } = require('./src/db');
const apiRouter = require('./src/routes');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// APIルートの適用
app.use('/api', apiRouter);

// 画面表示用のページルーティング
app.get('/', (req, res) => res.render('index'));
app.get('/profile', (req, res) => res.render('profile'));
app.get('/notifications', (req, res) => res.render('notifications'));

// 404エラーハンドリング（リダイレクトではなく404専用EJSを表示）
app.use((req, res) => {
  res.status(404).render('404');
});

initDB().then(() => {
  app.listen(port, () => console.log(`Server: http://localhost:${port}`));
}).catch(console.error);
