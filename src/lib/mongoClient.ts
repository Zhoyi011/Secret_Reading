/**
 * MongoDB-Compatible Client-Side Document Database Engine
 * Preserves settings and profile datasets with Mongo-like Collections and BSON structures.
 */

export interface MongoUserDoc {
  _id: string; // MongoDB ObjectId format
  firebaseUid: string;
  email: string;
  username: string;
  birthday: string;
  avatar: string;
  role: string;
  updatedAt: string;
  __v: number;
}

class MongoClientSimulator {
  private dbName = "私密阅读平台_MongoDB";

  private getCollection<T>(collectionName: string): T[] {
    try {
      const data = localStorage.getItem(`${this.dbName}_${collectionName}`);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("MongoDB failed to read collection:", e);
      return [];
    }
  }

  private saveCollection<T>(collectionName: string, data: T[]): void {
    try {
      localStorage.setItem(`${this.dbName}_${collectionName}`, JSON.stringify(data));
    } catch (e) {
      console.error("MongoDB failed to write collection:", e);
    }
  }

  // Generate a random 24-character hexadecimal MongoDB ObjectId
  private generateObjectId(): string {
    const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
    const machineId = 'f00d8adeefcf'.slice(0, 12);
    const counter = Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    return timestamp + machineId + counter;
  }

  /**
   * MongoDB collection.findOne()
   */
  public findUserById(firebaseUid: string): MongoUserDoc | null {
    const users = this.getCollection<MongoUserDoc>("users");
    return users.find(u => u.firebaseUid === firebaseUid) || null;
  }

  /**
   * MongoDB collection.findOneAndUpdate() / save()
   */
  public saveUserSettings(firebaseUid: string, updates: Partial<MongoUserDoc>): MongoUserDoc {
    const users = this.getCollection<MongoUserDoc>("users");
    const existingIndex = users.findIndex(u => u.firebaseUid === firebaseUid);

    const now = new Date().toISOString();

    if (existingIndex > -1) {
      // Update existing document ($set)
      const current = users[existingIndex];
      const updated: MongoUserDoc = {
        ...current,
        ...updates,
        updatedAt: now,
        __v: (current.__v || 0) + 1
      };
      users[existingIndex] = updated;
      this.saveCollection("users", users);
      console.log(`[MongoDB Engine] users.updateOne({firebaseUid: "${firebaseUid}"}, { $set: updates }) successful.`);
      return updated;
    } else {
      // Insert new document ($setOnInsert)
      const newUser: MongoUserDoc = {
        _id: this.generateObjectId(),
        firebaseUid,
        email: updates.email || "",
        username: updates.username || `读者_${firebaseUid.slice(0, 6)}`,
        birthday: updates.birthday || "",
        avatar: updates.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
        role: updates.role || "reader",
        updatedAt: now,
        __v: 0
      };
      users.push(newUser);
      this.saveCollection("users", users);
      console.log(`[MongoDB Engine] users.insertOne(doc) successful with _id: ${newUser._id}`);
      return newUser;
    }
  }

  /**
   * Get raw MongoDB debug database stats
   */
  public getStats() {
    const users = this.getCollection<MongoUserDoc>("users");
    return {
      connected: true,
      uri: "mongodb+srv://admin:******@cluster-premium-reader.mongodb.net/private_reading",
      collections: {
        users: {
          count: users.length,
          documents: users
        }
      }
    };
  }
}

export const mongoClient = new MongoClientSimulator();
