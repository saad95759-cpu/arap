const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const app = express();

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('./arab_ac.sqlite');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS employees (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, nationalId TEXT UNIQUE, department TEXT, jobTitle TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS attendance (id INTEGER PRIMARY KEY AUTOINCREMENT, nationalId TEXT, date TEXT, checkIn TEXT, checkOut TEXT, status TEXT, delayMinutes INTEGER, exception TEXT, manualOvertime INTEGER)`);
  db.run(`CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK (id = 1), startTime TEXT, graceTime TEXT, endTime TEXT, workDays TEXT, adminPassword TEXT)`);
  
  db.get("SELECT count(*) as c FROM settings", (err, r) => {
    if(r.c === 0) db.run(`INSERT INTO settings (id, startTime, graceTime, endTime, workDays, adminPassword) VALUES (1, '08:00', '08:30', '17:00', '["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"]', '1234')`);
  });
});

// APIs
app.get('/api/employees', (req, res) => db.all("SELECT * FROM employees", (err, rows) => res.json(rows)));
app.post('/api/employees', (req, res) => db.run("INSERT INTO employees (name, nationalId, department, jobTitle) VALUES (?,?,?,?)", [req.body.name, req.body.nationalId, req.body.department, req.body.jobTitle], () => res.sendStatus(200)));
app.delete('/api/employees/:id', (req, res) => db.run("DELETE FROM employees WHERE id=?", [req.params.id], () => res.sendStatus(200)));

app.get('/api/attendance', (req, res) => db.all("SELECT * FROM attendance", (err, rows) => {
    const parsed = rows.map(r => ({...r, exception: r.exception ? JSON.parse(r.exception) : null}));
    res.json(parsed);
}));
app.post('/api/attendance', (req, res) => db.run("INSERT INTO attendance (nationalId, date, checkIn, status, delayMinutes, manualOvertime) VALUES (?,?,?,?,?,?)", [req.body.nationalId, req.body.date, req.body.checkIn, req.body.status, req.body.delayMinutes, req.body.manualOvertime || 0], () => res.sendStatus(200)));
app.put('/api/attendance/:id', (req, res) => {
    const { checkOut, exception, manualOvertime } = req.body;
    let query = "UPDATE attendance SET "; let params = [];
    if(checkOut !== undefined) { query += "checkOut=?,"; params.push(checkOut); }
    if(exception !== undefined) { query += "exception=?,"; params.push(exception ? JSON.stringify(exception) : null); }
    if(manualOvertime !== undefined) { query += "manualOvertime=?,"; params.push(manualOvertime); }
    query = query.slice(0, -1) + " WHERE id=?"; params.push(req.params.id);
    db.run(query, params, () => res.sendStatus(200));
});

app.get('/api/settings', (req, res) => db.get("SELECT * FROM settings WHERE id=1", (err, r) => res.json({...r, workDays: JSON.parse(r.workDays)})));
app.put('/api/settings', (req, res) => db.run("UPDATE settings SET startTime=?, graceTime=?, endTime=?, workDays=?, adminPassword=? WHERE id=1", [req.body.startTime, req.body.graceTime, req.body.endTime, JSON.stringify(req.body.workDays), req.body.adminPassword], () => res.sendStatus(200)));

app.listen(3001, () => console.log('Arab Ac Backend running on port 3001'));