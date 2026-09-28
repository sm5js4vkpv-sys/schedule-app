from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    full_name = db.Column(db.String(150))
    role = db.Column(db.String(20), default='student')  # admin / student

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {'id': self.id, 'username': self.username,
                'full_name': self.full_name, 'role': self.role}


class Group(db.Model):
    __tablename__ = 'groups'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    speciality = db.Column(db.String(100))
    course = db.Column(db.Integer)

    def to_dict(self):
        return {'id': self.id, 'name': self.name,
                'speciality': self.speciality, 'course': self.course}


class Teacher(db.Model):
    __tablename__ = 'teachers'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    short_name = db.Column(db.String(20))
    color = db.Column(db.String(20), default='#3498db')

    def to_dict(self):
        return {'id': self.id, 'name': self.name,
                'short_name': self.short_name, 'color': self.color}


class Subject(db.Model):
    __tablename__ = 'subjects'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    short_name = db.Column(db.String(30))

    def to_dict(self):
        return {'id': self.id, 'name': self.name, 'short_name': self.short_name}


class TeacherSubject(db.Model):
    __tablename__ = 'teacher_subjects'
    teacher_id = db.Column(db.Integer, db.ForeignKey('teachers.id'), primary_key=True)
    subject_id = db.Column(db.Integer, db.ForeignKey('subjects.id'), primary_key=True)


class Classroom(db.Model):
    __tablename__ = 'classrooms'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(20), nullable=False)
    type = db.Column(db.String(50))
    seats = db.Column(db.Integer)

    def to_dict(self):
        return {'id': self.id, 'name': self.name,
                'type': self.type, 'seats': self.seats}


class Lesson(db.Model):
    __tablename__ = 'lessons'
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    teacher_id = db.Column(db.Integer, db.ForeignKey('teachers.id'), nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False)
    classroom_id = db.Column(db.Integer, db.ForeignKey('classrooms.id'))
    day = db.Column(db.String(20), nullable=False)
    week1_lesson = db.Column(db.Integer)
    week2_lesson = db.Column(db.Integer)
    lesson_type = db.Column(db.String(30), default='Лекция')

    def to_dict(self):
        return {
            'id': self.id,
            'group_id': self.group_id,
            'teacher_id': self.teacher_id,
            'subject_id': self.subject_id,
            'classroom_id': self.classroom_id,
            'day': self.day,
            'week1_lesson': self.week1_lesson,
            'week2_lesson': self.week2_lesson,
            'lesson_type': self.lesson_type,
        }