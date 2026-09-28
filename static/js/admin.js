// ============================================================
//  АДМИН-ПАНЕЛЬ
// ============================================================

const A = {};
const data = { groups: [], teachers: [], subjects: [], classrooms: [], lessons: [] };

function $(s) { return document.querySelector(s); }
function $$(s) { return document.querySelectorAll(s); }

function toast(msg, type = '') {
    const el = $('#toast');
    el.textContent = msg;
    el.className = 'toast show ' + type;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.className = 'toast hidden'; }, 2500);
}

async function api(url, options = {}) {
    const res = await fetch(url, options);
    if (res.status === 204) return { ok: true, data: null };
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data: d };
}

// ---------- Навигация ----------
$$('.admin-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        $$('.admin-nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        $$('.admin-section').forEach(s => s.classList.remove('active'));
        $('#section-' + btn.dataset.section).classList.add('active');
    });
});

// ---------- Загрузка данных ----------
async function loadAll() {
    const [g, t, s, c, l] = await Promise.all([
        api('/api/groups'), api('/api/teachers'), api('/api/subjects'),
        api('/api/classrooms'), api('/api/schedule')
    ]);
    data.groups = g.data || [];
    data.teachers = t.data || [];
    data.subjects = s.data || [];
    data.classrooms = c.data || [];
    data.lessons = l.data || [];

    renderGroups();
    renderTeachers();
    renderSubjects();
    renderClassrooms();
    renderLessons();

    fillLessonSelects();
    fillTeacherSubjectCheckboxes();
}

// ---------- Отрисовка ----------
function renderGroups() {
    const box = $('#list-groups');
    box.innerHTML = '';
    data.groups.forEach(g => {
        box.innerHTML += `
            <div class="admin-item">
                <div class="admin-item-info">
                    <div class="admin-item-title">${g.name}</div>
                    <div class="admin-item-sub">${g.speciality || ''} · курс ${g.course || '—'}</div>
                </div>
                <div class="admin-item-actions">
                    <button class="edit" onclick="editGroup(${g.id})">✏</button>
                    <button class="del" onclick="delGroup(${g.id})">🗑</button>
                </div>
            </div>`;
    });
}

function renderTeachers() {
    const box = $('#list-teachers');
    box.innerHTML = '';
    data.teachers.forEach(t => {
        const subs = (t.subjects || []).map(s => s.short_name || s.name).join(', ');
        box.innerHTML += `
            <div class="admin-item">
                <div class="admin-item-info">
                    <div class="admin-item-title" style="color:${t.color}">
                        <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${t.color};margin-right:8px"></span>
                        ${t.name} ${t.short_name ? '(' + t.short_name + ')' : ''}
                    </div>
                    <div class="admin-item-sub">${subs || 'без дисциплин'}</div>
                </div>
                <div class="admin-item-actions">
                    <button class="edit" onclick="editTeacher(${t.id})">✏</button>
                    <button class="del" onclick="delTeacher(${t.id})">🗑</button>
                </div>
            </div>`;
    });
}

function renderSubjects() {
    const box = $('#list-subjects');
    box.innerHTML = '';
    data.subjects.forEach(s => {
        box.innerHTML += `
            <div class="admin-item">
                <div class="admin-item-info">
                    <div class="admin-item-title">${s.name}</div>
                    <div class="admin-item-sub">${s.short_name || ''}</div>
                </div>
                <div class="admin-item-actions">
                    <button class="edit" onclick="editSubject(${s.id})">✏</button>
                    <button class="del" onclick="delSubject(${s.id})">🗑</button>
                </div>
            </div>`;
    });
}

function renderClassrooms() {
    const box = $('#list-classrooms');
    box.innerHTML = '';
    data.classrooms.forEach(c => {
        box.innerHTML += `
            <div class="admin-item">
                <div class="admin-item-info">
                    <div class="admin-item-title">каб. ${c.name}</div>
                    <div class="admin-item-sub">${c.type || ''} ${c.seats ? '· ' + c.seats + ' мест' : ''}</div>
                </div>
                <div class="admin-item-actions">
                    <button class="del" onclick="delClassroom(${c.id})">🗑</button>
                </div>
            </div>`;
    });
}

function renderLessons() {
    const box = $('#list-lessons');
    box.innerHTML = '';
    data.lessons.forEach(l => {
        box.innerHTML += `
            <div class="admin-item">
                <div class="admin-item-info">
                    <div class="admin-item-title">${l.subject_name} → ${l.group_name}</div>
                    <div class="admin-item-sub">${l.teacher_name} · ${l.day} · 1нед: ${l.week1_lesson || '—'} / 2нед: ${l.week2_lesson || '—'} ${l.classroom_name ? '· каб.' + l.classroom_name : ''}</div>
                </div>
                <div class="admin-item-actions">
                    <button class="edit" onclick="editLesson(${l.id})">✏</button>
                    <button class="del" onclick="delLesson(${l.id})">🗑</button>
                </div>
            </div>`;
    });
}

// ---------- Selects ----------
function fillLessonSelects() {
    const opts = (items, val, txt) => items.map(i => `<option value="${i[val]}">${i[txt]}</option>`).join('');
    $('#lesson-group').innerHTML = opts(data.groups, 'id', 'name');
    $('#lesson-teacher').innerHTML = opts(data.teachers, 'id', 'name');
    $('#lesson-subject').innerHTML = opts(data.subjects, 'id', 'name');
    $('#lesson-classroom').innerHTML = '<option value="">— нет —</option>' +
        opts(data.classrooms, 'id', 'name');
}

function fillTeacherSubjectCheckboxes() {
    const box = $('#teacher-subjects');
    box.innerHTML = data.subjects.map(s => `
        <label><input type="checkbox" value="${s.id}"> ${s.name}</label>
    `).join('');
}

// ---------- CRUD: Группы ----------
$('#form-group').addEventListener('submit', async e => {
    e.preventDefault();
    const id = $('#group-id').value;
    const body = {
        name: $('#group-name').value,
        speciality: $('#group-speciality').value,
        course: parseInt($('#group-course').value) || null
    };
    const url = id ? '/api/groups/' + id : '/api/groups';
    const method = id ? 'PUT' : 'POST';
    const res = await api(url, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) });
    if (!res.ok) { toast(res.data.error || 'Ошибка', 'error'); return; }
    toast('Сохранено', 'success');
    resetForm('group');
    loadAll();
});

window.editGroup = id => {
    const g = data.groups.find(x => x.id === id);
    $('#group-id').value = g.id;
    $('#group-name').value = g.name;
    $('#group-speciality').value = g.speciality || '';
    $('#group-course').value = g.course || '';
};

window.delGroup = async id => {
    if (!confirm('Удалить группу?')) return;
    await api('/api/groups/' + id, { method: 'DELETE' });
    toast('Удалено', 'success');
    loadAll();
};

// ---------- CRUD: Преподаватели ----------
$('#form-teacher').addEventListener('submit', async e => {
    e.preventDefault();
    const id = $('#teacher-id').value;
    const subject_ids = [...$$('#teacher-subjects input:checked')].map(c => parseInt(c.value));
    const body = {
        name: $('#teacher-name').value,
        short_name: $('#teacher-short').value,
        color: $('#teacher-color').value,
        subject_ids: subject_ids
    };
    const url = id ? '/api/teachers/' + id : '/api/teachers';
    const method = id ? 'PUT' : 'POST';
    const res = await api(url, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) });
    if (!res.ok) { toast(res.data.error || 'Ошибка', 'error'); return; }
    toast('Сохранено', 'success');
    resetForm('teacher');
    loadAll();
});

window.editTeacher = id => {
    const t = data.teachers.find(x => x.id === id);
    $('#teacher-id').value = t.id;
    $('#teacher-name').value = t.name;
    $('#teacher-short').value = t.short_name || '';
    $('#teacher-color').value = t.color || '#3498db';
    const ids = (t.subjects || []).map(s => s.id);
    $$('#teacher-subjects input').forEach(c => c.checked = ids.includes(parseInt(c.value)));
};

window.delTeacher = async id => {
    if (!confirm('Удалить преподавателя?')) return;
    await api('/api/teachers/' + id, { method: 'DELETE' });
    toast('Удалено', 'success');
    loadAll();
};

// ---------- CRUD: Дисциплины ----------
$('#form-subject').addEventListener('submit', async e => {
    e.preventDefault();
    const id = $('#subject-id').value;
    const body = {
        name: $('#subject-name').value,
        short_name: $('#subject-short').value
    };
    const url = id ? '/api/subjects/' + id : '/api/subjects';
    const method = id ? 'PUT' : 'POST';
    const res = await api(url, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) });
    if (!res.ok) { toast(res.data.error || 'Ошибка', 'error'); return; }
    toast('Сохранено', 'success');
    resetForm('subject');
    loadAll();
});

window.editSubject = id => {
    const s = data.subjects.find(x => x.id === id);
    $('#subject-id').value = s.id;
    $('#subject-name').value = s.name;
    $('#subject-short').value = s.short_name || '';
};

window.delSubject = async id => {
    if (!confirm('Удалить дисциплину?')) return;
    await api('/api/subjects/' + id, { method: 'DELETE' });
    toast('Удалено', 'success');
    loadAll();
};

// ---------- CRUD: Кабинеты ----------
$('#form-classroom').addEventListener('submit', async e => {
    e.preventDefault();
    const id = $('#classroom-id').value;
    const body = {
        name: $('#classroom-name').value,
        type: $('#classroom-type').value,
        seats: parseInt($('#classroom-seats').value) || null
    };
    const url = id ? '/api/classrooms/' + id : '/api/classrooms';
    const res = await api('/api/classrooms', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) });
    if (!res.ok) { toast(res.data.error || 'Ошибка', 'error'); return; }
    toast('Сохранено', 'success');
    resetForm('classroom');
    loadAll();
});

window.delClassroom = async id => {
    if (!confirm('Удалить кабинет?')) return;
    await api('/api/classrooms/' + id, { method: 'DELETE' });
    toast('Удалено', 'success');
    loadAll();
};

// ---------- CRUD: Занятия ----------
$('#form-lesson').addEventListener('submit', async e => {
    e.preventDefault();
    const id = $('#lesson-id').value;
    const body = {
        group_id: parseInt($('#lesson-group').value),
        teacher_id: parseInt($('#lesson-teacher').value),
        subject_id: parseInt($('#lesson-subject').value),
        classroom_id: $('#lesson-classroom').value ? parseInt($('#lesson-classroom').value) : null,
        day: $('#lesson-day').value,
        week1_lesson: $('#lesson-week1').value ? parseInt($('#lesson-week1').value) : null,
        week2_lesson: $('#lesson-week2').value ? parseInt($('#lesson-week2').value) : null,
        lesson_type: $('#lesson-type').value || 'Лекция'
    };
    const url = id ? '/api/schedule/' + id : '/api/schedule';
    const method = id ? 'PUT' : 'POST';
    const res = await api(url, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) });
    if (!res.ok) {
        const c = res.data.conflicts || [res.data.error || 'Ошибка'];
        toast('⚠ ' + c.join('; '), 'error');
        return;
    }
    toast('Сохранено', 'success');
    resetForm('lesson');
    loadAll();
});

window.editLesson = id => {
    const l = data.lessons.find(x => x.id === id);
    $('#lesson-id').value = l.id;
    $('#lesson-group').value = l.group_id;
    $('#lesson-teacher').value = l.teacher_id;
    $('#lesson-subject').value = l.subject_id;
    $('#lesson-classroom').value = l.classroom_id || '';
    $('#lesson-day').value = l.day;
    $('#lesson-week1').value = l.week1_lesson || '';
    $('#lesson-week2').value = l.week2_lesson || '';
    $('#lesson-type').value = l.lesson_type || 'Лекция';
    $$('.admin-nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-section="lessons"]').classList.add('active');
    $$('.admin-section').forEach(s => s.classList.remove('active'));
    $('#section-lessons').classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.delLesson = async id => {
    if (!confirm('Удалить занятие?')) return;
    await api('/api/schedule/' + id, { method: 'DELETE' });
    toast('Удалено', 'success');
    loadAll();
};

// ---------- Сброс формы ----------
window.resetForm = name => {
    const f = $('#form-' + name);
    if (f) f.reset();
    const id = $('#' + name + '-id');
    if (id) id.value = '';
    if (name === 'teacher') {
        $('#teacher-color').value = '#3498db';
        $$('#teacher-subjects input').forEach(c => c.checked = false);
    }
};

// ---------- Старт ----------
loadAll();