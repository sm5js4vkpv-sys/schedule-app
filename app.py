from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from functools import wraps
from models import db, User, Group, Teacher, Subject, TeacherSubject, Classroom, Lesson

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///schedule.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.secret_key = 'change-me-in-production-please-12345'
db.init_app(app)


# ============================================================
#  ДЕКОРАТОРЫ ДОСТУПА
# ============================================================
def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login_page'))
        return f(*args, **kwargs)
    return wrapper


def admin_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login_page'))
        if session.get('role') != 'admin':
            return jsonify({'error': 'Доступ только для администратора'}), 403
        return f(*args, **kwargs)
    return wrapper


def current_user():
    uid = session.get('user_id')
    return User.query.get(uid) if uid else None


# ============================================================
#  ИНИЦИАЛИЗАЦИЯ ДАННЫХ
# ============================================================
def seed_data():
    # Админ по умолчанию
    if User.query.filter_by(username='admin').count() == 0:
        admin = User(username='admin', full_name='Администратор', role='admin')
        admin.set_password('admin123')
        db.session.add(admin)
        db.session.commit()

    if Group.query.count() == 0:
        db.session.add_all([
            Group(name='П-21', speciality='Программирование', course=2),
            Group(name='П-22', speciality='Программирование', course=2),
            Group(name='ИС-21', speciality='Информационные системы', course=2),
        ])

    if Teacher.query.count() == 0:
        t1 = Teacher(name='Иванов Сергей Владимирович', short_name='ИВ', color='#3498db')
        t2 = Teacher(name='Петрова Анна Ивановна', short_name='ПЕ', color='#2ecc71')
        t3 = Teacher(name='Сидоров Дмитрий Алексеевич', short_name='СИ', color='#f1c40f')
        db.session.add_all([t1, t2, t3])
        db.session.commit()

        s1 = Subject(name='Информатика', short_name='ИНФ')
        s2 = Subject(name='Основы алгоритмизации и программирования', short_name='ОАП')
        s3 = Subject(name='Программирование', short_name='ПРОГ')
        s4 = Subject(name='Математика', short_name='МАТ')
        s5 = Subject(name='Базы данных', short_name='БД')
        db.session.add_all([s1, s2, s3, s4, s5])
        db.session.commit()

        links = [
            (t1.id, s1.id), (t1.id, s2.id), (t1.id, s3.id),
            (t2.id, s4.id),
            (t3.id, s3.id), (t3.id, s5.id),
        ]
        for tid, sid in links:
            db.session.add(TeacherSubject(teacher_id=tid, subject_id=sid))

    if Classroom.query.count() == 0:
        db.session.add_all([
            Classroom(name='305', type='Компьютерный класс', seats=25),
            Classroom(name='204', type='Лекционная', seats=40),
            Classroom(name='312', type='Компьютерный класс', seats=20),
        ])
    db.session.commit()


with app.app_context():
    db.create_all()
    seed_data()


# ============================================================
#  АВТОРИЗАЦИЯ
# ============================================================
@app.route('/login', methods=['GET', 'POST'])
def login_page():
    if request.method == 'GET':
        if 'user_id' in session:
            return redirect(url_for('index'))
        return render_template('login.html')

    d = request.json or request.form
    username = d.get('username', '').strip()
    password = d.get('password', '')

    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Неверный логин или пароль'}), 401

    session['user_id'] = user.id
    session['role'] = user.role
    session['username'] = user.username
    session['full_name'] = user.full_name
    return jsonify({'ok': True, 'role': user.role})


@app.route('/register', methods=['POST'])
def register():
    d = request.json or request.form
    username = d.get('username', '').strip()
    password = d.get('password', '')
    full_name = d.get('full_name', '').strip()

    if not username or not password:
        return jsonify({'error': 'Введите логин и пароль'}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Такой логин уже существует'}), 409

    user = User(username=username, full_name=full_name or username, role='student')
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    session['user_id'] = user.id
    session['role'] = user.role
    session['username'] = user.username
    session['full_name'] = user.full_name
    return jsonify({'ok': True})


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login_page'))


@app.route('/api/me')
def api_me():
    u = current_user()
    if not u:
        return jsonify({'error': 'not authenticated'}), 401
    return jsonify(u.to_dict())


# ============================================================
#  ГЛАВНЫЕ СТРАНИЦЫ
# ============================================================
@app.route('/')
@login_required
def index():
    return render_template('index.html', user=current_user())


@app.route('/admin')
@login_required
def admin_page():
    if session.get('role') != 'admin':
        return redirect(url_for('index'))
    return render_template('admin.html', user=current_user())


# ============================================================
#  ГРУППЫ
# ============================================================
@app.route('/api/groups', methods=['GET'])
@login_required
def get_groups():
    return jsonify([g.to_dict() for g in Group.query.all()])


@app.route('/api/groups', methods=['POST'])
@admin_required
def add_group():
    d = request.json
    g = Group(name=d['name'], speciality=d.get('speciality'), course=d.get('course'))
    db.session.add(g)
    db.session.commit()
    return jsonify(g.to_dict()), 201


@app.route('/api/groups/<int:gid>', methods=['PUT'])
@admin_required
def update_group(gid):
    d = request.json
    g = Group.query.get_or_404(gid)
    g.name = d.get('name', g.name)
    g.speciality = d.get('speciality', g.speciality)
    g.course = d.get('course', g.course)
    db.session.commit()
    return jsonify(g.to_dict())


@app.route('/api/groups/<int:gid>', methods=['DELETE'])
@admin_required
def delete_group(gid):
    Lesson.query.filter_by(group_id=gid).delete()
    Group.query.filter_by(id=gid).delete()
    db.session.commit()
    return '', 204


# ============================================================
#  ПРЕПОДАВАТЕЛИ
# ============================================================
@app.route('/api/teachers', methods=['GET'])
@login_required
def get_teachers():
    result = []
    for t in Teacher.query.all():
        subjects = Subject.query.join(TeacherSubject).filter(
            TeacherSubject.teacher_id == t.id).all()
        d = t.to_dict()
        d['subjects'] = [s.to_dict() for s in subjects]
        result.append(d)
    return jsonify(result)


@app.route('/api/teachers', methods=['POST'])
@admin_required
def add_teacher():
    d = request.json
    t = Teacher(name=d['name'], short_name=d.get('short_name', ''),
                color=d.get('color', '#3498db'))
    db.session.add(t)
    db.session.commit()
    for sid in d.get('subject_ids', []):
        db.session.add(TeacherSubject(teacher_id=t.id, subject_id=sid))
    db.session.commit()
    return jsonify(t.to_dict()), 201


@app.route('/api/teachers/<int:tid>', methods=['PUT'])
@admin_required
def update_teacher(tid):
    d = request.json
    t = Teacher.query.get_or_404(tid)
    t.name = d.get('name', t.name)
    t.short_name = d.get('short_name', t.short_name)
    t.color = d.get('color', t.color)
    if 'subject_ids' in d:
        TeacherSubject.query.filter_by(teacher_id=tid).delete()
        for sid in d['subject_ids']:
            db.session.add(TeacherSubject(teacher_id=tid, subject_id=sid))
    db.session.commit()
    return jsonify(t.to_dict())


@app.route('/api/teachers/<int:tid>', methods=['DELETE'])
@admin_required
def delete_teacher(tid):
    Lesson.query.filter_by(teacher_id=tid).delete()
    TeacherSubject.query.filter_by(teacher_id=tid).delete()
    Teacher.query.filter_by(id=tid).delete()
    db.session.commit()
    return '', 204


# ============================================================
#  ДИСЦИПЛИНЫ
# ============================================================
@app.route('/api/subjects', methods=['GET'])
@login_required
def get_subjects():
    return jsonify([s.to_dict() for s in Subject.query.all()])


@app.route('/api/subjects', methods=['POST'])
@admin_required
def add_subject():
    d = request.json
    s = Subject(name=d['name'], short_name=d.get('short_name', ''))
    db.session.add(s)
    db.session.commit()
    return jsonify(s.to_dict()), 201


@app.route('/api/subjects/<int:sid>', methods=['PUT'])
@admin_required
def update_subject(sid):
    d = request.json
    s = Subject.query.get_or_404(sid)
    s.name = d.get('name', s.name)
    s.short_name = d.get('short_name', s.short_name)
    db.session.commit()
    return jsonify(s.to_dict())


@app.route('/api/subjects/<int:sid>', methods=['DELETE'])
@admin_required
def delete_subject(sid):
    Lesson.query.filter_by(subject_id=sid).delete()
    TeacherSubject.query.filter_by(subject_id=sid).delete()
    Subject.query.filter_by(id=sid).delete()
    db.session.commit()
    return '', 204


# ============================================================
#  КАБИНЕТЫ
# ============================================================
@app.route('/api/classrooms', methods=['GET'])
@login_required
def get_classrooms():
    return jsonify([c.to_dict() for c in Classroom.query.all()])


@app.route('/api/classrooms', methods=['POST'])
@admin_required
def add_classroom():
    d = request.json
    c = Classroom(name=d['name'], type=d.get('type'), seats=d.get('seats'))
    db.session.add(c)
    db.session.commit()
    return jsonify(c.to_dict()), 201


@app.route('/api/classrooms/<int:cid>', methods=['DELETE'])
@admin_required
def delete_classroom(cid):
    Lesson.query.filter_by(classroom_id=cid).update({'classroom_id': None})
    Classroom.query.filter_by(id=cid).delete()
    db.session.commit()
    return '', 204


# ============================================================
#  ЗАНЯТИЯ
# ============================================================
@app.route('/api/schedule', methods=['GET'])
@login_required
def get_schedule():
    result = []
    for l in Lesson.query.all():
        d = l.to_dict()
        teacher = Teacher.query.get(l.teacher_id)
        subject = Subject.query.get(l.subject_id)
        group = Group.query.get(l.group_id)
        classroom = Classroom.query.get(l.classroom_id) if l.classroom_id else None
        d['teacher_name'] = teacher.name if teacher else ''
        d['teacher_short'] = teacher.short_name if teacher else ''
        d['teacher_color'] = teacher.color if teacher else '#999'
        d['subject_name'] = subject.name if subject else ''
        d['group_name'] = group.name if group else ''
        d['classroom_name'] = classroom.name if classroom else ''
        result.append(d)
    return jsonify(result)


def check_conflicts(lesson):
    conflicts = []

    def overlaps(l1, l2):
        if l1.day != l2.day:
            return False
        pairs1 = {(1, l1.week1_lesson), (2, l1.week2_lesson)} - {(1, None), (2, None)}
        pairs2 = {(1, l2.week1_lesson), (2, l2.week2_lesson)} - {(1, None), (2, None)}
        return bool(pairs1 & pairs2)

    others = Lesson.query.filter(Lesson.id != (lesson.id or -1)).all()
    for o in others:
        if not overlaps(lesson, o):
            continue
        if o.teacher_id == lesson.teacher_id:
            conflicts.append(f"Преподаватель занят: {o.day}, группа "
                             f"{Group.query.get(o.group_id).name}")
        if o.group_id == lesson.group_id:
            conflicts.append(f"Группа занята: {o.day}")
        if lesson.classroom_id and o.classroom_id == lesson.classroom_id:
            conflicts.append(f"Кабинет {Classroom.query.get(o.classroom_id).name} занят")
    return conflicts


@app.route('/api/schedule', methods=['POST'])
@admin_required
def add_lesson():
    d = request.json
    lesson = Lesson(
        group_id=d['group_id'], teacher_id=d['teacher_id'],
        subject_id=d['subject_id'], classroom_id=d.get('classroom_id'),
        day=d['day'], week1_lesson=d.get('week1_lesson'),
        week2_lesson=d.get('week2_lesson'),
        lesson_type=d.get('lesson_type', 'Лекция')
    )
    conflicts = check_conflicts(lesson)
    if conflicts:
        return jsonify({'error': 'Конфликт расписания', 'conflicts': conflicts}), 409
    db.session.add(lesson)
    db.session.commit()
    return jsonify(lesson.to_dict()), 201


@app.route('/api/schedule/<int:lid>', methods=['PUT'])
@admin_required
def update_lesson(lid):
    d = request.json
    lesson = Lesson.query.get_or_404(lid)
    for field in ['group_id', 'teacher_id', 'subject_id', 'classroom_id',
                  'day', 'week1_lesson', 'week2_lesson', 'lesson_type']:
        if field in d:
            setattr(lesson, field, d[field])
    conflicts = check_conflicts(lesson)
    if conflicts:
        return jsonify({'error': 'Конфликт расписания', 'conflicts': conflicts}), 409
    db.session.commit()
    return jsonify(lesson.to_dict())


@app.route('/api/schedule/<int:lid>', methods=['DELETE'])
@admin_required
def delete_lesson(lid):
    Lesson.query.filter_by(id=lid).delete()
    db.session.commit()
    return '', 204


# ============================================================
#  СТАТИСТИКА
# ============================================================
@app.route('/api/stats/teachers', methods=['GET'])
@login_required
def teacher_stats():
    stats = []
    for t in Teacher.query.all():
        lessons = Lesson.query.filter_by(teacher_id=t.id).all()
        count = sum((1 if l.week1_lesson else 0) + (1 if l.week2_lesson else 0)
                    for l in lessons)
        stats.append({'teacher': t.name, 'short': t.short_name,
                      'color': t.color, 'lessons_per_week': count})
    return jsonify(sorted(stats, key=lambda x: -x['lessons_per_week']))


if __name__ == '__main__':
    app.run(debug=True)