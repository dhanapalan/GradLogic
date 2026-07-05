import api from "../lib/api";

export interface Announcement {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "error";
  createdAt: string;
  expiresAt?: string;
  active: boolean;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  createdAt: string;
}

class NotificationService {
  /**
   * Get all announcements
   */
  async getAnnouncements(): Promise<Announcement[]> {
    try {
      const response = await api.get("/superadmin/announcements");
      return response.data?.data || [];
    } catch (error) {
      console.error("Failed to fetch announcements:", error);
      throw error;
    }
  }

  /**
   * Create announcement
   */
  async createAnnouncement(
    title: string,
    message: string,
    type: "info" | "warning" | "success" | "error"
  ): Promise<Announcement> {
    try {
      const response = await api.post("/superadmin/announcements", {
        title,
        message,
        type,
      });
      return response.data?.data;
    } catch (error) {
      console.error("Failed to create announcement:", error);
      throw error;
    }
  }

  /**
   * Update announcement
   */
  async updateAnnouncement(
    id: string,
    data: Partial<Announcement>
  ): Promise<Announcement> {
    try {
      const response = await api.put(`/superadmin/announcements/${id}`, data);
      return response.data?.data;
    } catch (error) {
      console.error(`Failed to update announcement ${id}:`, error);
      throw error;
    }
  }

  async deactivateAnnouncement(id: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/superadmin/announcements/${id}`);
    return response.data;
  }

  /** @deprecated use deactivateAnnouncement */
  async deleteAnnouncement(id: string) {
    return this.deactivateAnnouncement(id);
  }

  async activateAnnouncement(id: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post(`/superadmin/announcements/${id}/activate`);
    return response.data;
  }

  /**
   * Get all email templates
   */
  async getEmailTemplates(): Promise<EmailTemplate[]> {
    try {
      const response = await api.get("/superadmin/email-templates");
      return response.data?.data || [];
    } catch (error) {
      console.error("Failed to fetch email templates:", error);
      throw error;
    }
  }

  /**
   * Create email template
   */
  async createEmailTemplate(
    name: string,
    subject: string,
    body: string,
    variables?: string[]
  ): Promise<EmailTemplate> {
    try {
      const response = await api.post("/superadmin/email-templates", {
        name,
        subject,
        body,
        variables: variables || [],
      });
      return response.data?.data;
    } catch (error) {
      console.error("Failed to create email template:", error);
      throw error;
    }
  }

  /**
   * Update email template
   */
  async updateEmailTemplate(
    id: string,
    data: Partial<EmailTemplate>
  ): Promise<EmailTemplate> {
    try {
      const response = await api.put(`/superadmin/email-templates/${id}`, data);
      return response.data?.data;
    } catch (error) {
      console.error(`Failed to update email template ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete email template
   */
  async deleteEmailTemplate(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.delete(`/superadmin/email-templates/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to delete email template ${id}:`, error);
      throw error;
    }
  }
}

export default new NotificationService();
