import mongoose from "mongoose";

const studentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        minlength: 3,
        maxlength: 30,
        match: /^[a-z0-9_]+$/
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    mobileNumber: {
        type: String,
        required: true,
        unique: true,
        match: /^[6-9]\d{9}$/
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    joinedAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    address: {
        street: {
            type: String,
            trim: true,
            maxlength: 200
        },
        city: {
            type: String,
            trim: true,
            maxlength: 100
        },
        state: {
            type: String,
            trim: true,
            maxlength: 100
        },
        country: {
            type: String,
            trim: true,
            maxlength: 100,
            default: "India"
        },
        pincode: {
            type: String,
            trim: true,
            match: /^\d{6}$/
        }
    },
    image: {
        type: String,
        trim: true
    },
    courses: [{
        courseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course'
        },
        enrolledAt: {
            type: Date,
            default: Date.now
        },
        completionStatus: {
            type: String,
            enum: ['enrolled', 'in-progress', 'completed', 'paused'],
            default: 'enrolled'
        },
        progressPercentage: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
        }
    }],
    specialization: {
        type: String,
        enum: ['IIT-JEE', 'NEET', 'CBSE'],
        required: true
    },
    class: {
        type: String,
        enum: [
            'Class 6th', 'Class 7th', 'Class 8th', 'Class 9th', 'Class 10th',
            'Class 11th', 'Class 12th', 'Dropper'
        ],
        required: true
    },
    tests: [{
        testId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Test'
        },
        attemptedAt: {
            type: Date,
            default: Date.now
        },
        score: {
            type: Number,
            min: 0
        },
        totalMarks: {
            type: Number,
            min: 0
        },
        percentage: {
            type: Number,
            min: 0,
            max: 100
        },
        status: {
            type: String,
            enum: ['started', 'completed', 'abandoned'],
            default: 'started'
        },
        timeTaken: {
            type: Number, // in minutes
            min: 0
        }
    }],
    testSeries: [{
        testSeriesId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'TestSeries'
        },
        enrolledAt: {
            type: Date,
            default: Date.now
        },
        progress: {
            testsCompleted: {
                type: Number,
                default: 0
            },
            totalTests: {
                type: Number,
                default: 0
            },
            averageScore: {
                type: Number,
                default: 0
            }
        }
    }],
    webinars: [{
        webinarId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Webinar'
        },
        registeredAt: {
            type: Date,
            default: Date.now
        },
        attended: {
            type: Boolean,
            default: false
        },
        attendanceTime: {
            type: Number, // in minutes
            default: 0
        }
    }],
    followingEducators: [{
        educatorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Educator'
        },
        followedAt: {
            type: Date,
            default: Date.now
        }
    }],
    results: [{
        testId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Test'
        },
        title: { type: String },
        testSeriesId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'TestSeries'
        },
        score: {
            type: Number,
            required: true
        },
        totalMarks: {
            type: Number,
            required: true
        },
        percentage: {
            type: Number,
            required: true
        },
        rank: {
            type: Number
        },
        completedAt: {
            type: Date,
            default: Date.now
        },
        subjects: [{
            name: {
                type: String,
                enum: ['Physics', 'Chemistry', 'Biology', 'Mathematics', 'English']
            },
            score: {
                type: Number
            },
            totalMarks: {
                type: Number
            }
        }]
    }],
    role: {
        type: String,
        default: 'student',
        immutable: true
    },
    progress: {
        testsTaken: {
            type: Number,
            default: 0
        },
        avgScore: {
            type: Number,
            default: 0
        },
        rank: {
            type: Number
        },
        totalStudyTime: {
            type: Number, // in minutes
            default: 0
        },
        streakDays: {
            type: Number,
            default: 0
        },
        lastActiveDate: {
            type: Date,
            default: Date.now
        }
    },
    deviceToken: {
        type: String,
        trim: true
    },
    // Additional fields for better user experience
    preferences: {
        notifications: {
            email: {
                type: Boolean,
                default: true
            },
            push: {
                type: Boolean,
                default: true
            },
            sms: {
                type: Boolean,
                default: false
            }
        },
        language: {
            type: String,
            default: 'english',
            enum: ['english', 'hindi']
        },
        theme: {
            type: String,
            default: 'light',
            enum: ['light', 'dark']
        }
    }
}, {
    timestamps: true // This will add createdAt and updatedAt automatically
});

// Create indexes for better performance (excluding fields that already have unique: true)
studentSchema.index({ specialization: 1 });
studentSchema.index({ class: 1 });
studentSchema.index({ isActive: 1 });
studentSchema.index({ 'courses.courseId': 1 });
studentSchema.index({ 'followingEducators.educatorId': 1 });

// Pre-save middleware to update the updatedAt field
studentSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Static method to find active students
studentSchema.statics.findActive = function() {
    return this.find({ isActive: true });
};

// Static method to find students by specialization
studentSchema.statics.findBySpecialization = function(specialization) {
    return this.find({ specialization, isActive: true });
};

// Static method to find students by class
studentSchema.statics.findByClass = function(className) {
    return this.find({ class: className, isActive: true });
};

// Static method to find students following a specific educator
studentSchema.statics.findFollowersOf = function(educatorId) {
    return this.find({ 
        'followingEducators.educatorId': educatorId,
        isActive: true 
    });
};

// Method to add course enrollment
studentSchema.methods.enrollInCourse = function(courseId) {
    const existingCourse = this.courses.find(course => 
        course.courseId.toString() === courseId.toString()
    );
    
    if (!existingCourse) {
        this.courses.push({ courseId });
    }
    
    return this.save();
};

// Method to follow an educator
studentSchema.methods.followEducator = function(educatorId) {
    const existingFollow = this.followingEducators.find(follow => 
        follow.educatorId.toString() === educatorId.toString()
    );
    
    if (!existingFollow) {
        this.followingEducators.push({ educatorId });
    }
    
    return this.save();
};

// Method to unfollow an educator
studentSchema.methods.unfollowEducator = function(educatorId) {
    this.followingEducators = this.followingEducators.filter(follow => 
        follow.educatorId.toString() !== educatorId.toString()
    );
    
    return this.save();
};

// Method to add test result
studentSchema.methods.addTestResult = function(testData) {
    this.tests.push(testData);
    this.results.push(testData);
    
    // Update progress
    this.progress.testsTaken += 1;
    
    // Calculate new average score
    const totalScore = this.results.reduce((sum, result) => sum + result.percentage, 0);
    this.progress.avgScore = totalScore / this.results.length;
    
    return this.save();
};

// Method to register for webinar
studentSchema.methods.registerForWebinar = function(webinarId) {
    const existingRegistration = this.webinars.find(webinar => 
        webinar.webinarId.toString() === webinarId.toString()
    );
    
    if (!existingRegistration) {
        this.webinars.push({ webinarId });
    }
    
    return this.save();
};

// Virtual to get total courses enrolled
studentSchema.virtual('totalCoursesEnrolled').get(function() {
    return this.courses ? this.courses.length : 0;
});

// Virtual to get total educators following
studentSchema.virtual('totalEducatorsFollowing').get(function() {
    return this.followingEducators ? this.followingEducators.length : 0;
});

// Virtual to get completion percentage of courses
studentSchema.virtual('overallCourseProgress').get(function() {
    if (!this.courses || this.courses.length === 0) return 0;
    
    const totalProgress = this.courses.reduce((sum, course) => sum + course.progressPercentage, 0);
    return Math.round(totalProgress / this.courses.length);
});

// Virtual to get test performance grade
studentSchema.virtual('performanceGrade').get(function() {
    const avgScore = this.progress.avgScore;
    if (avgScore >= 90) return 'A+';
    if (avgScore >= 80) return 'A';
    if (avgScore >= 70) return 'B+';
    if (avgScore >= 60) return 'B';
    if (avgScore >= 50) return 'C+';
    if (avgScore >= 40) return 'C';
    return 'D';
});

// Ensure virtual fields are included in JSON output
studentSchema.set('toJSON', { virtuals: true });
studentSchema.set('toObject', { virtuals: true });

// Method to get student statistics
studentSchema.methods.getStudentStats = function() {
    return {
        totalCourses: this.totalCoursesEnrolled,
        totalEducatorsFollowing: this.totalEducatorsFollowing,
        overallProgress: this.overallCourseProgress,
        testsTaken: this.progress.testsTaken,
        avgScore: this.progress.avgScore,
        currentRank: this.progress.rank,
        performanceGrade: this.performanceGrade,
        streakDays: this.progress.streakDays,
        joinedDaysAgo: Math.floor((Date.now() - this.joinedAt) / (1000 * 60 * 60 * 24))
    };
};

export default mongoose.model("Student", studentSchema);