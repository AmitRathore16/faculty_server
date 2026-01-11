import Course from "../models/course.js";
import TestSeries from "../models/testSeries.js";
import Webinar from "../models/webinar.js";
import LiveClass from "../models/liveClass.js";
import Student from "../models/student.js";

const PRODUCT_TYPES = {
  course: {
    model: Course,
    price: (course) => {
      const discount = course.discount || 0;
      const discountAmount = (course.fees * discount) / 100;
      return Math.max(course.fees - discountAmount, 0);
    },
    isActive: (course) => course.isActive !== false,
    hasCapacity: (course) => {
      if (!course.maxStudents) return true;
      const enrolled = course.enrolledStudents?.length || 0;
      return enrolled < course.maxStudents;
    },
  },
  testSeries: {
    model: TestSeries,
    price: (testSeries) => testSeries.price,
    isActive: (series) => series.isActive !== false,
    hasCapacity: () => true,
  },
  webinar: {
    model: Webinar,
    price: (webinar) => webinar.fees,
    isActive: (webinar) => webinar.isActive !== false,
    hasCapacity: (webinar) => {
      if (!webinar.seatLimit) return true;
      const enrolled = webinar.studentEnrolled?.length || 0;
      return enrolled < webinar.seatLimit;
    },
  },
  liveClass: {
    model: LiveClass,
    price: (liveClass) => liveClass.liveClassesFee,
    isActive: (liveClass) => liveClass.isActive !== false && !liveClass.isCompleted,
    hasCapacity: (liveClass) => {
      if (!liveClass.maxStudents) return true;
      const enrolled = liveClass.enrolledStudents?.length || 0;
      return enrolled < liveClass.maxStudents;
    },
  },
};

export const getStudentById = async (studentId) => {
  const student = await Student.findById(studentId);
  if (!student || !student.isActive) {
    throw new Error("Student not found or inactive");
  }
  return student;
};

export const getProductDetails = async (productType, productId) => {
  const config = PRODUCT_TYPES[productType];
  if (!config) {
    throw new Error("Unsupported product type");
  }

  const product = await config.model.findById(productId);
  if (!product) {
    throw new Error(`Unable to find ${productType}`);
  }

  if (!config.isActive(product)) {
    throw new Error(`${productType} is inactive`);
  }

  if (!config.hasCapacity(product)) {
    throw new Error(`${productType} has reached capacity`);
  }

  const price = config.price(product);
  if (!price || price <= 0) {
    throw new Error(`${productType} has invalid price`);
  }

  return { product, price };
};

export const isStudentAlreadyEnrolled = (productType, product, studentId) => {
  const studentObjectId = studentId.toString();
  if (productType === "course") {
    return (
      product.enrolledStudents?.some(
        (id) => id.toString() === studentObjectId
      ) || product.purchase?.some((id) => id.toString() === studentObjectId)
    );
  }
  if (productType === "testSeries") {
    return product.enrolledStudents?.some(
      (id) => id.toString() === studentObjectId
    );
  }
  if (productType === "webinar") {
    return product.studentEnrolled?.some(
      (id) => id.toString() === studentObjectId
    );
  }
  if (productType === "liveClass") {
    return product.enrolledStudents?.some((entry) => {
      const id = entry?.studentId || entry; // schema stores objects
      return id?.toString() === studentObjectId;
    });
  }
  return false;
};

export const enrollStudentInProduct = async (
  productType,
  productId,
  studentId,
  productSnapshot = {}
) => {
  const student = await Student.findById(studentId);
  if (!student) {
    throw new Error("Student not found");
  }

  if (productType === "course") {
    await Course.findByIdAndUpdate(productId, {
      $addToSet: {
        enrolledStudents: studentId,
        purchase: studentId,
      },
    });

    const alreadyEnrolled = student.courses?.some(
      (entry) => entry.courseId.toString() === productId.toString()
    );
    if (!alreadyEnrolled) {
      student.courses = student.courses || [];
      student.courses.push({ courseId: productId, enrolledAt: new Date() });
      await student.save();
    }
    return;
  }

  if (productType === "testSeries") {
    await TestSeries.findByIdAndUpdate(productId, {
      $addToSet: { enrolledStudents: studentId },
    });

    const alreadyEnrolled = student.testSeries?.some(
      (entry) => entry.testSeriesId.toString() === productId.toString()
    );
    if (!alreadyEnrolled) {
      student.testSeries = student.testSeries || [];
      student.testSeries.push({
        testSeriesId: productId,
        enrolledAt: new Date(),
        progress: {
          testsCompleted: 0,
          totalTests: productSnapshot.numberOfTests || 0,
          averageScore: 0,
        },
      });
      await student.save();
    }
    return;
  }

  if (productType === "webinar") {
    await Webinar.findByIdAndUpdate(productId, {
      $addToSet: { studentEnrolled: studentId },
    });

    const alreadyRegistered = student.webinars?.some(
      (entry) => entry.webinarId.toString() === productId.toString()
    );
    if (!alreadyRegistered) {
      student.webinars = student.webinars || [];
      student.webinars.push({ webinarId: productId, registeredAt: new Date() });
      await student.save();
    }
    return;
  }

  if (productType === "liveClass") {
    await LiveClass.findByIdAndUpdate(productId, {
      $addToSet: {
        enrolledStudents: {
          studentId,
          enrolledAt: new Date(),
        },
      },
    });

    return;
  }

  throw new Error("Unsupported product type for enrollment");
};
