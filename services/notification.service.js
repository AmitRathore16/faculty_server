import mongoose from "mongoose";
import Notification from "../models/notification.js";
import Educator from "../models/educator.js";
import Course from "../models/course.js";
import Webinar from "../models/webinar.js";
import Post from "../models/post.js";
import TestSeries from "../models/testSeries.js";
import LiveClass from "../models/liveClass.js";

class NotificationService {
  constructor() {
    // This will be set by the socket handler
    this.io = null;
  }

  // Set Socket.io instance
  setSocketIO(io) {
    this.io = io;
  }

  // Get socket.io instance
  getSocketIO() {
    return this.io;
  }

  // Create notification templates
  getNotificationTemplate(type, educatorName, contentData) {
    const templates = {
      course: {
        title: `New Course Launched!`,
        message: `${educatorName} has launched a new course: "${contentData.title}"`,
      },
      webinar: {
        title: `Upcoming Webinar!`,
        message: `Join ${educatorName}'s webinar "${
          contentData.title
        }" on ${this.formatDate(
          contentData.timing || contentData.scheduledDate
        )}`,
      },
      post: {
        title: `New Post!`,
        message: `${educatorName} shared: "${contentData.title}"`,
      },
      test_series: {
        title: `New Test Series Available!`,
        message: `${educatorName} has created a new test series: "${contentData.title}"`,
      },
      live_class: {
        title: `New Live Class Scheduled!`,
        message: `${educatorName} has scheduled a live class: "${
          contentData.title
        }" on ${this.formatDate(contentData.classTiming)}`,
      },
    };

    return templates[type] || { title: "New Update", message: "Check it out!" };
  }

  // Format date for display
  formatDate(date) {
    if (!date) return "soon";
    const dateObj = new Date(date);
    const options = { year: "numeric", month: "short", day: "numeric" };
    return dateObj.toLocaleDateString("en-US", options);
  }

  // Create a single notification
  async createNotification(notificationData) {
    try {
      const notification = new Notification(notificationData);
      await notification.save();
      return notification;
    } catch (error) {
      console.error("Error creating notification:", error);
      throw error;
    }
  }

  // Notify all followers of an educator
  async notifyFollowers(educatorId, type, contentData) {
    try {
      // Fetch educator with followers populated
      const educator = await Educator.findById(educatorId)
        .select("fullName username followers profilePicture image slug")
        .populate({
          path: "followers",
          select: "preferences deviceToken",
        });

      if (!educator) {
        throw new Error("Educator not found");
      }

      if (!educator.followers || educator.followers.length === 0) {
        console.log("No followers to notify");
        return { success: true, notificationsSent: 0 };
      }

      // Generate notification template
      const template = this.getNotificationTemplate(
        type,
        educator.fullName,
        contentData
      );

      const metadata = this.buildNotificationMetadata(type, contentData);

      // Create notifications for all followers
      const notifications = [];
      const onlineStudents = [];

      for (const followerEntry of educator.followers) {
        const followerId = this.resolveId(followerEntry);
        if (!followerId) {
          continue;
        }

        const followerPreferences =
          followerEntry?.preferences?.notifications?.push !== false;
        const pushEnabled =
          typeof followerEntry === "object" && followerEntry !== null
            ? followerPreferences
            : true;

        if (!pushEnabled) {
          console.log(
            `Push notifications disabled for student: ${followerId}`
          );
          continue;
        }

        const notification = await this.createNotification({
          recipient: followerId,
          sender: educatorId,
          type,
          title: template.title,
          message: template.message,
          metadata,
        });

        notifications.push(notification);

        if (this.io) {
          const studentSocketId = this.getSocketIdByUserId(followerId);
          if (studentSocketId) {
            this.io.to(studentSocketId).emit("notification", {
              type,
              notification: {
                _id: notification._id,
                title: template.title,
                message: template.message,
                type,
                metadata: this.normalizeMetadata(metadata, type),
                isRead: false,
                createdAt: notification.createdAt,
                sender: {
                  _id: educatorId,
                  fullName: educator.fullName,
                  username: educator.username,
                  profilePicture:
                    educator.profilePicture ||
                    this.resolveMediaUrl(educator.image),
                },
              },
            });

            notification.deliveredAt = new Date();
            await notification.save();

            onlineStudents.push(followerId);
          }
        }
      }

      console.log(
        `Sent ${notifications.length} notifications (${onlineStudents.length} delivered in real-time)`
      );

      return {
        success: true,
        notificationsSent: notifications.length,
        deliveredInRealTime: onlineStudents.length,
        notifications,
      };
    } catch (error) {
      console.error("Error notifying followers:", error);
      throw error;
    }
  }

  // Get socket ID by user ID (this will be maintained by socket handler)
  getSocketIdByUserId(userId) {
    if (!this.io) return null;

    // Access the userSockets Map from the socket handler
    const userSockets = this.io.userSockets || new Map();
    return userSockets.get(userId);
  }

  // Get notifications for a student
  async getNotificationsByStudent(studentId, options = {}) {
    try {
      const { page = 1, limit = 20, unreadOnly = false, type = null } = options;

      const filter = { recipient: studentId };

      if (unreadOnly) {
        filter.isRead = false;
      }

      if (type) {
        filter.type = type;
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const notifications = await Notification.find(filter)
        .populate("sender", "fullName username profilePicture slug image")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      const totalNotifications = await Notification.countDocuments(filter);
      const totalPages = Math.ceil(totalNotifications / parseInt(limit));

      const enrichedNotifications = await this.enrichNotifications(
        notifications
      );

      return {
        success: true,
        notifications: enrichedNotifications,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalNotifications,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
        },
      };
    } catch (error) {
      console.error("Error fetching notifications:", error);
      throw error;
    }
  }

  // Get unread notification count
  async getUnreadCount(studentId) {
    try {
      const count = await Notification.getUnreadCount(studentId);
      return { success: true, unreadCount: count };
    } catch (error) {
      console.error("Error getting unread count:", error);
      throw error;
    }
  }

  // Mark notification as read
  async markAsRead(notificationId, studentId) {
    try {
      const notification = await Notification.findOne({
        _id: notificationId,
        recipient: studentId,
      });

      if (!notification) {
        throw new Error("Notification not found");
      }

      const wasAlreadyRead = notification.isRead;

      if (!wasAlreadyRead) {
        await notification.markAsRead();
      }

      await notification.populate(
        "sender",
        "fullName username profilePicture slug image"
      );

      const [enriched] = await this.enrichNotifications([
        notification.toObject(),
      ]);

      return {
        success: true,
        message: wasAlreadyRead
          ? "Notification already read"
          : "Notification marked as read",
        notification: enriched || null,
      };
    } catch (error) {
      console.error("Error marking notification as read:", error);
      throw error;
    }
  }

  // Mark all notifications as read
  async markAllAsRead(studentId) {
    try {
      const result = await Notification.markAllAsRead(studentId);

      return {
        success: true,
        message: "All notifications marked as read",
        modifiedCount: result.modifiedCount,
      };
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      throw error;
    }
  }

  // Delete notification
  async deleteNotification(notificationId, studentId) {
    try {
      const notification = await Notification.findOneAndDelete({
        _id: notificationId,
        recipient: studentId,
      });

      if (!notification) {
        throw new Error("Notification not found");
      }

      return { success: true, message: "Notification deleted" };
    } catch (error) {
      console.error("Error deleting notification:", error);
      throw error;
    }
  }

  // Clean up old notifications (can be run as a cron job)
  async cleanupOldNotifications() {
    try {
      const result = await Notification.cleanupOldNotifications();
      console.log(`Cleaned up ${result.deletedCount} old notifications`);
      return { success: true, deletedCount: result.deletedCount };
    } catch (error) {
      console.error("Error cleaning up notifications:", error);
      throw error;
    }
  }

  // ===== Helper utilities =====

  buildNotificationMetadata(type, contentData = {}) {
    const resourceId = this.maybeCastObjectId(contentData?._id);
    const slug = this.resolveSlug(contentData);
    const route = this.buildResourceRoute(type, {
      _id: resourceId || contentData?._id,
      slug,
    });

    const metadata = {
      resourceType: type,
      resourceId,
      contentTitle: contentData?.title || null,
      contentSlug: slug,
      resourceRoute: route,
      link: route,
      thumbnail:
        this.resolveMediaUrl(contentData?.thumbnail) ||
        this.resolveThumbnail(contentData) ||
        null,
      summary:
        contentData?.summary ||
        this.buildSummaryFromText(
          this.extractDescriptionPayload(contentData)
        ),
    };

    switch (type) {
      case "course":
        metadata.courseId = resourceId;
        metadata.price = this.resolveNumber(contentData?.fees);
        metadata.courseType = contentData?.courseType || null;
        metadata.scheduledDate =
          this.resolveDate(contentData?.startDate) ||
          this.resolveDate(contentData?.validDate) ||
          null;
        break;
      case "webinar":
        metadata.webinarId = resourceId;
        metadata.scheduledDate = this.resolveDate(
          contentData?.timing || contentData?.scheduledDate
        );
        metadata.webinarType = contentData?.webinarType || null;
        metadata.duration = contentData?.duration || null;
        metadata.price = this.resolveNumber(contentData?.fees);
        break;
      case "post":
        metadata.postId = resourceId;
        break;
      case "test_series":
        metadata.testSeriesId = resourceId;
        metadata.price = this.resolveNumber(contentData?.price);
        metadata.numberOfTests = this.resolveNumber(
          contentData?.numberOfTests
        );
        metadata.validity = this.resolveNumber(contentData?.validity);
        break;
      case "live_class":
        metadata.liveClassId = resourceId;
        metadata.scheduledDate = this.resolveDate(contentData?.classTiming);
        metadata.duration = contentData?.classDuration || null;
        metadata.price = this.resolveNumber(contentData?.liveClassesFee);
        break;
      default:
        break;
    }

    return this.removeEmptyMetadata(metadata);
  }

  maybeCastObjectId(value) {
    if (!value) {
      return undefined;
    }

    if (value instanceof mongoose.Types.ObjectId) {
      return value;
    }

    if (typeof value === "string" && mongoose.Types.ObjectId.isValid(value)) {
      return new mongoose.Types.ObjectId(value);
    }

    if (value && typeof value === "object" && value._id) {
      return this.maybeCastObjectId(value._id);
    }

    return undefined;
  }

  resolveId(value) {
    if (!value) {
      return null;
    }

    if (typeof value === "string") {
      return value.trim().length > 0 ? value.trim() : null;
    }

    if (value instanceof mongoose.Types.ObjectId) {
      return value.toString();
    }

    if (typeof value === "object") {
      if (value._id) {
        return this.resolveId(value._id);
      }

      if (value.id) {
        return this.resolveId(value.id);
      }

      if (typeof value.toString === "function") {
        const serialized = value.toString();
        if (
          serialized &&
          serialized !== "[object Object]" &&
          mongoose.Types.ObjectId.isValid(serialized)
        ) {
          return serialized;
        }
      }
    }

    return null;
  }

  resolveSlug(payload) {
    if (!payload) {
      return null;
    }

    if (typeof payload === "string" && payload.trim().length > 0) {
      return payload.trim();
    }

    const candidates = [payload.slug, payload.contentSlug, payload.slugId];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }

    return null;
  }

  resolveNumber(value) {
    if (typeof value === "number" && !Number.isNaN(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      return Number.isNaN(parsed) ? null : parsed;
    }

    return null;
  }

  resolveDate(value) {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  resolveISODate(value) {
    const date = this.resolveDate(value);
    return date ? date.toISOString() : null;
  }

  extractDescriptionPayload(payload) {
    if (!payload || typeof payload !== "object") {
      return null;
    }

    const description =
      payload.description ?? payload.details ?? payload.message ?? null;

    if (!description) {
      return null;
    }

    if (typeof description === "string") {
      return description;
    }

    if (typeof description === "object") {
      const keys = ["long", "short", "text", "body", "summary"];
      for (const key of keys) {
        const candidate = description[key];
        if (typeof candidate === "string" && candidate.trim().length > 0) {
          return candidate;
        }
      }
    }

    return null;
  }

  buildSummaryFromText(text, limit = 180) {
    if (!text || typeof text !== "string") {
      return null;
    }

    const normalized = text.replace(/\s+/g, " ").trim();
    if (!normalized) {
      return null;
    }

    if (normalized.length <= limit) {
      return normalized;
    }

    return `${normalized.slice(0, limit - 3).trim()}...`;
  }

  resolveMediaUrl(candidate) {
    if (!candidate) {
      return null;
    }

    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }

    if (Array.isArray(candidate)) {
      for (const entry of candidate) {
        const resolved = this.resolveMediaUrl(entry);
        if (resolved) {
          return resolved;
        }
      }
      return null;
    }

    if (typeof candidate === "object") {
      const preferredKeys = ["secure_url", "url", "src", "path", "href"];
      for (const key of preferredKeys) {
        if (candidate[key] && typeof candidate[key] === "string") {
          const value = candidate[key].trim();
          if (value.length > 0) {
            return value;
          }
        }
      }

      if (candidate.preview) {
        return this.resolveMediaUrl(candidate.preview);
      }
    }

    return null;
  }

  resolveThumbnail(payload) {
    if (!payload) {
      return null;
    }

    if (typeof payload === "string") {
      return this.resolveMediaUrl(payload);
    }

    const candidateKeys = [
      "thumbnail",
      "image",
      "courseThumbnail",
      "coverImage",
      "bannerImage",
      "featureImage",
      "previewImage",
      "poster",
      "profilePicture",
      "avatar",
    ];

    for (const key of candidateKeys) {
      if (payload[key]) {
        const resolved = this.resolveMediaUrl(payload[key]);
        if (resolved) {
          return resolved;
        }
      }
    }

    if (payload.media) {
      return this.resolveThumbnail(payload.media);
    }

    return null;
  }

  buildResourceRoute(type, payload = {}) {
    const slug = this.resolveSlug(payload);
    const id = this.resolveId(payload);
    const slugOrId = slug || id;

    if (!slugOrId) {
      return null;
    }

    const baseRouteMap = {
      course: "/details/course/",
      webinar: "/student-webinars/",
      post: "/posts/",
      test_series: "/student-test-series/",
      live_class: "/1-1-live-class/",
    };

    const baseRoute = baseRouteMap[type];
    if (!baseRoute) {
      return null;
    }

    return `${baseRoute}${slugOrId}`;
  }

  removeEmptyMetadata(metadata) {
    const cleaned = {};

    Object.entries(metadata || {}).forEach(([key, value]) => {
      if (value === undefined) {
        return;
      }
      cleaned[key] = value;
    });

    if (cleaned.link === undefined && cleaned.resourceRoute !== undefined) {
      cleaned.link = cleaned.resourceRoute;
    }

    return cleaned;
  }

  normalizeMetadata(metadata, type) {
    if (!metadata || typeof metadata !== "object") {
      return { resourceType: type };
    }

    const normalized = {};

    Object.entries(metadata).forEach(([key, value]) => {
      if (value === undefined) {
        return;
      }
      normalized[key] = this.normalizeMetadataValue(value);
    });

    if (!normalized.resourceId) {
      const fallbackId = this.getFallbackResourceId(type, normalized);
      if (fallbackId) {
        normalized.resourceId = this.resolveId(fallbackId);
      }
    } else {
      normalized.resourceId = this.resolveId(normalized.resourceId);
    }

    if (!normalized.resourceType) {
      normalized.resourceType = type;
    }

    if (!normalized.link && normalized.resourceRoute) {
      normalized.link = normalized.resourceRoute;
    }

    if (!normalized.resourceRoute && normalized.link) {
      normalized.resourceRoute = normalized.link;
    }

    if (!normalized.contentTitle && normalized.title) {
      normalized.contentTitle = normalized.title;
    }

    if (normalized.scheduledDate) {
      normalized.scheduledDate = this.resolveISODate(normalized.scheduledDate);
    }

    return normalized;
  }

  normalizeMetadataValue(value) {
    if (value === null) {
      return null;
    }

    if (value instanceof mongoose.Types.ObjectId) {
      return value.toString();
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      return value.map((entry) => this.normalizeMetadataValue(entry));
    }

    if (typeof value === "object") {
      const normalized = {};
      Object.entries(value).forEach(([key, nested]) => {
        normalized[key] = this.normalizeMetadataValue(nested);
      });
      return normalized;
    }

    return value;
  }

  getFallbackResourceId(type, metadata = {}) {
    switch (type) {
      case "course":
        return metadata.courseId || null;
      case "webinar":
        return metadata.webinarId || null;
      case "post":
        return metadata.postId || null;
      case "test_series":
        return metadata.testSeriesId || null;
      case "live_class":
        return metadata.liveClassId || null;
      default:
        return metadata.resourceId || metadata.entityId || null;
    }
  }

  getMetadataKeyForType(type) {
    const map = {
      course: "metadata.courseId",
      webinar: "metadata.webinarId",
      post: "metadata.postId",
      test_series: "metadata.testSeriesId",
      live_class: "metadata.liveClassId",
    };

    return map[type] || null;
  }

  collectResourceIds(notifications = []) {
    const buckets = {
      course: new Set(),
      webinar: new Set(),
      post: new Set(),
      test_series: new Set(),
      live_class: new Set(),
    };

    notifications.forEach((notification) => {
      if (!notification || !notification.type) {
        return;
      }

      const type = notification.type;
      if (!buckets[type]) {
        return;
      }

      const metadata = notification.metadata || {};
      const candidateIds = [
        metadata.resourceId,
        metadata.courseId,
        metadata.webinarId,
        metadata.postId,
        metadata.testSeriesId,
        metadata.liveClassId,
        notification.entityId,
        notification.contentId,
      ];

      for (const candidate of candidateIds) {
        const resolved = this.resolveId(candidate);
        if (resolved) {
          buckets[type].add(resolved);
          return;
        }
      }
    });

    return buckets;
  }

  resolveEntityId(notification) {
    if (!notification) {
      return null;
    }

    const metadata = notification.metadata || {};
    const fallbackKeys = [
      "resourceId",
      "entityId",
      "contentId",
      "courseId",
      "webinarId",
      "postId",
      "testSeriesId",
      "liveClassId",
    ];

    for (const key of fallbackKeys) {
      const value = metadata[key] ?? notification[key];
      const resolved = this.resolveId(value);
      if (resolved) {
        return resolved;
      }
    }

    return null;
  }

  async enrichNotifications(notifications = []) {
    if (!Array.isArray(notifications) || notifications.length === 0) {
      return [];
    }

    const normalized = notifications.map((notification) =>
      typeof notification.toObject === "function"
        ? notification.toObject()
        : { ...notification }
    );

    const buckets = this.collectResourceIds(normalized);

    const [courses, webinars, posts, testSeries, liveClasses] =
      await Promise.all([
        buckets.course.size
          ? Course.find({ _id: { $in: Array.from(buckets.course) } })
              .select(
                "title slug description image courseThumbnail fees startDate courseType validDate"
              )
              .lean()
          : [],
        buckets.webinar.size
          ? Webinar.find({ _id: { $in: Array.from(buckets.webinar) } })
              .select(
                "title slug description image webinarType timing duration fees subject specialization class"
              )
              .lean()
          : [],
        buckets.post.size
          ? Post.find({ _id: { $in: Array.from(buckets.post) } })
              .select("title description subjects specializations createdAt")
              .lean()
          : [],
        buckets.test_series.size
          ? TestSeries.find({ _id: { $in: Array.from(buckets.test_series) } })
              .select(
                "title slug description image price numberOfTests validity"
              )
              .lean()
          : [],
        buckets.live_class.size
          ? LiveClass.find({ _id: { $in: Array.from(buckets.live_class) } })
              .select(
                "liveClassTitle slug description classTiming classDuration liveClassesFee subject introVideo"
              )
              .lean()
          : [],
      ]);

    const resourceMaps = {
      course: new Map(courses.map((doc) => [this.resolveId(doc), doc])),
      webinar: new Map(webinars.map((doc) => [this.resolveId(doc), doc])),
      post: new Map(posts.map((doc) => [this.resolveId(doc), doc])),
      test_series: new Map(
        testSeries.map((doc) => [this.resolveId(doc), doc])
      ),
      live_class: new Map(
        liveClasses.map((doc) => [this.resolveId(doc), doc])
      ),
    };

    const pruneTargets = [];

    const transformed = normalized
      .map((notification) =>
        this.transformNotification(notification, resourceMaps, pruneTargets)
      )
      .filter(Boolean);

    if (pruneTargets.length > 0) {
      const uniqueTargets = new Map();

      pruneTargets.forEach(({ type, resourceId }) => {
        if (!type || !resourceId) {
          return;
        }

        const key = `${type}:${resourceId}`;
        if (!uniqueTargets.has(key)) {
          uniqueTargets.set(key, { type, resourceId });
        }
      });

      await Promise.all(
        Array.from(uniqueTargets.values()).map(({ type, resourceId }) =>
          this.removeNotificationsForResource(type, resourceId).catch((error) =>
            console.error(
              "Failed to prune notifications for resource:",
              type,
              resourceId,
              error
            )
          )
        )
      );
    }

    return transformed;
  }

  transformNotification(notification, resourceMaps, pruneTargets = []) {
    if (!notification) {
      return null;
    }

    const type = notification.type;
    const metadata = this.normalizeMetadata(notification.metadata, type);
    const entityId = metadata.resourceId || this.resolveEntityId(notification);
    const resourceMap = resourceMaps[type] || new Map();
    const resource = entityId ? resourceMap.get(entityId) : null;

    let route =
      metadata.resourceRoute ||
      metadata.link ||
      this.buildResourceRoute(type, {
        _id: entityId,
        slug: metadata.contentSlug,
      });

    if (type === "course" && route?.includes("/student-courses/")) {
      const modernRoute = this.buildResourceRoute(type, {
        _id: entityId,
        slug: metadata.contentSlug,
      });

      if (modernRoute && modernRoute !== route) {
        route = modernRoute;

        if (metadata) {
          metadata.resourceRoute = modernRoute;

          if (metadata.link?.includes("/student-courses/")) {
            metadata.link = modernRoute;
          }
        }
      }
    }

    if (route && metadata) {
      if (!metadata.resourceRoute) {
        metadata.resourceRoute = route;
      }

      if (!metadata.link) {
        metadata.link = route;
      }
    }

    const contentSnapshot = resource
      ? this.buildContentSnapshot(type, resource, {
          ...metadata,
          resourceId: entityId,
          resourceRoute: route,
        })
      : this.buildFallbackSnapshot(type, entityId, route, metadata);

    if (!contentSnapshot || contentSnapshot.available === false) {
      if (entityId) {
        pruneTargets.push({ type, resourceId: entityId });
      }
      return null;
    }

    const educator = this.transformEducator(notification.sender);

    return {
      id: this.resolveId(notification._id) || null,
      type,
      title: notification.title,
      message: notification.message,
      isRead: Boolean(notification.isRead),
      isDelivered: Boolean(notification.deliveredAt),
      createdAt: this.resolveISODate(notification.createdAt),
      readAt: this.resolveISODate(notification.readAt),
      deliveredAt: this.resolveISODate(notification.deliveredAt),
      educator,
      educatorName:
        educator?.fullName ||
        educator?.username ||
        metadata.educatorName ||
        "Educator",
      entityId: contentSnapshot?.id || metadata.resourceId || entityId || null,
      link: contentSnapshot?.route || null,
      metadata,
      content: contentSnapshot,
    };
  }

  buildContentSnapshot(type, resource, metadata = {}) {
    const id = this.resolveId(resource) || metadata.resourceId || null;
    const slug = this.resolveSlug(resource) || metadata.contentSlug || null;
    const route =
      metadata.resourceRoute ||
      metadata.link ||
      this.buildResourceRoute(type, { _id: id, slug });
    const thumbnail =
      metadata.thumbnail || this.resolveThumbnail(resource) || null;
    const summary =
      metadata.summary ||
      this.buildSummaryFromText(this.extractDescriptionPayload(resource));

    const snapshot = {
      id,
      type,
      title: this.resolveResourceTitle(type, resource, metadata),
      slug,
      thumbnail,
      summary,
      route,
      available: true,
    };

    switch (type) {
      case "course":
        snapshot.courseType = resource.courseType || metadata.courseType || null;
        snapshot.price =
          this.resolveNumber(resource.fees ?? resource.price) ??
          this.resolveNumber(metadata.price);
        snapshot.startsAt = this.resolveISODate(
          resource.startDate || metadata.scheduledDate
        );
        break;
      case "webinar":
        snapshot.scheduledAt = this.resolveISODate(
          resource.timing || metadata.scheduledDate
        );
        snapshot.duration = resource.duration || metadata.duration || null;
        snapshot.price =
          this.resolveNumber(resource.fees) || this.resolveNumber(metadata.price);
        snapshot.webinarType =
          resource.webinarType || metadata.webinarType || null;
        break;
      case "post":
        snapshot.publishedAt = this.resolveISODate(
          resource.createdAt || metadata.createdAt
        );
        break;
      case "test_series":
        snapshot.price =
          this.resolveNumber(resource.price) || this.resolveNumber(metadata.price);
        snapshot.numberOfTests =
          this.resolveNumber(resource.numberOfTests) ||
          this.resolveNumber(metadata.numberOfTests);
        snapshot.validity =
          this.resolveNumber(resource.validity) ||
          this.resolveNumber(metadata.validity);
        break;
      case "live_class":
        snapshot.scheduledAt = this.resolveISODate(
          resource.classTiming || metadata.scheduledDate
        );
        snapshot.duration =
          resource.classDuration || metadata.duration || null;
        snapshot.price =
          this.resolveNumber(resource.liveClassesFee) ||
          this.resolveNumber(metadata.price);
        break;
      default:
        break;
    }

    return snapshot;
  }

  buildFallbackSnapshot(type, entityId, route, metadata) {
    if (type === "broadcast_message") {
      return {
        id: entityId || null,
        type,
        title:
          metadata.contentTitle ||
          metadata.title ||
          metadata.subject ||
          "Message",
        slug: null,
        thumbnail: metadata.thumbnail || null,
        summary:
          metadata.summary ||
          metadata.message ||
          metadata.preview ||
          null,
        route: null,
        available: true,
      };
    }

    return {
      id: entityId,
      type,
      title: metadata.contentTitle || this.getTypeLabel(type),
      slug: metadata.contentSlug || null,
      thumbnail: metadata.thumbnail || null,
      summary: metadata.summary || null,
      route: route || null,
      available: false,
    };
  }

  resolveResourceTitle(type, resource, metadata) {
    if (resource?.title) {
      return resource.title;
    }

    if (type === "live_class" && resource?.liveClassTitle) {
      return resource.liveClassTitle;
    }

    return metadata.contentTitle || this.getTypeLabel(type);
  }

  transformEducator(sender) {
    if (!sender) {
      return null;
    }

    const raw =
      typeof sender.toObject === "function" ? sender.toObject() : sender;

    const avatar =
      this.resolveMediaUrl(raw.profilePicture) ||
      this.resolveMediaUrl(raw.image) ||
      null;

    return {
      id: this.resolveId(raw._id || raw.id || raw),
      fullName: raw.fullName || null,
      username: raw.username || null,
      slug: raw.slug || null,
      avatar,
    };
  }

  getTypeLabel(type) {
    const labels = {
      course: "Course",
      webinar: "Webinar",
      post: "Post",
      test_series: "Test Series",
      live_class: "Live Class",
      broadcast_message: "Message",
    };

    return labels[type] || "Update";
  }

  async removeNotificationsForResource(type, resourceId) {
    const resolvedId = this.resolveId(resourceId);

    if (!type || !resolvedId) {
      return { success: false, deletedCount: 0 };
    }

    const objectId = this.maybeCastObjectId(resourceId);
    const metadataKey = this.getMetadataKeyForType(type);

    const orConditions = [];

    if (objectId) {
      orConditions.push({ "metadata.resourceId": objectId });
      if (metadataKey) {
        orConditions.push({ [metadataKey]: objectId });
      }
    }

    orConditions.push({ "metadata.resourceId": resolvedId });
    if (metadataKey) {
      orConditions.push({ [metadataKey]: resolvedId });
    }

    const filter = {
      type,
      $or: orConditions,
    };

    try {
      const result = await Notification.deleteMany(filter);
      return {
        success: true,
        deletedCount: result?.deletedCount ?? 0,
      };
    } catch (error) {
      console.error(
        "Error removing notifications for resource:",
        type,
        resourceId,
        error
      );
      throw error;
    }
  }
}

// Export singleton instance
const notificationService = new NotificationService();
export default notificationService;

