const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'data.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// دوال قراءة وكتابة البيانات
function readData() {
  const rawData = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(rawData);
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// 1. جلب البيانات الأولية لواجهة الدخول (الأفواج فقط)
app.get('/api/init', (req, res) => {
  const db = readData();
  const safeGroups = db.groups.map(g => ({ id: g.id, name: g.name }));
  res.json({ systemName: db.systemName, groups: safeGroups });
});

// 2. تسجيل دخول رئيس القسم
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const db = readData();
  if (db.admin && db.admin.password === password) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
  }
});

// 3. تسجيل دخول ممثل الفوج وجلب جدوله المحفوظ
app.post('/api/delegate/login', (req, res) => {
  const { groupId, pin } = req.body;
  const db = readData();
  const group = db.groups.find(g => g.id === groupId && g.pin === String(pin));
  
  if (group) {
    // جلب الحصص المحفوظة (القوالب) الخاصة بهذا الفوج فقط
    const schedule = db.schedules.filter(s => s.groupId === groupId);
    res.json({ success: true, group: { id: group.id, name: group.name }, schedule });
  } else {
    res.status(401).json({ error: 'رمز الدخول (PIN) غير صحيح لهذا الفوج' });
  }
});

// 4. إضافة حصة جديدة للجدول الدائم (قالب)
app.post('/api/schedules', (req, res) => {
  const { groupId, day, time, subject, teacher, room } = req.body;
  if (!groupId || !day || !time || !subject || !teacher) {
    return res.status(400).json({ error: 'البيانات الأساسية للحصة ناقصة' });
  }

  const db = readData();
  const newSchedule = {
    id: 'sch_' + Date.now(),
    groupId, day, time, subject, teacher, room: room || 'غير محدد'
  };

  db.schedules.push(newSchedule);
  writeData(db);
  res.status(201).json({ message: 'تم حفظ الحصة في الجدول بنجاح', schedule: newSchedule });
});

// 5. حذف حصة من الجدول (للتعديل أو تصحيح خطأ)
app.delete('/api/schedules/:id', (req, res) => {
  const scheduleId = req.params.id;
  const db = readData();
  
  const initialLength = db.schedules.length;
  db.schedules = db.schedules.filter(s => s.id !== scheduleId);
  
  if (db.schedules.length < initialLength) {
    writeData(db);
    res.json({ success: true, message: 'تم حذف الحصة من الجدول' });
  } else {
    res.status(404).json({ error: 'لم يتم العثور على الحصة' });
  }
});

// 6. [مهم] جلب كافة الجداول الثابتة (مطلوبة لخمة "يجري الآن" في لوحة الإدارة)
app.get('/api/all-schedules', (req, res) => {
  const db = readData();
  res.json(db.schedules || []);
});

// 7. جلب التقارير للوحة تحكم الإدارة
app.get('/api/reports', (req, res) => {
  const db = readData();
  res.json(db.reports || []);
});

// 8. استقبال تقرير يومي (متابعة الإنجاز)
app.post('/api/reports', (req, res) => {
  const { groupId, scheduleId, subject, teacher, time, status, notes, delegateName } = req.body;
  if (!groupId || !status) return res.status(400).json({ error: 'بيانات ناقصة' });

  const db = readData();
  const newReport = {
    id: 'rep_' + Date.now(),
    groupId, scheduleId, subject, teacher, time, status, 
    notes: notes || '',
    delegateName: delegateName || 'ممثل الفوج',
    timestamp: new Date().toISOString()
  };

  db.reports.unshift(newReport);
  writeData(db);
  res.status(201).json({ message: 'تم إرسال التقرير', report: newReport });
});

app.listen(PORT, () => {
  console.log(`🟢 السيرفر الذكي يعمل الآن على: http://localhost:${PORT}`);
});