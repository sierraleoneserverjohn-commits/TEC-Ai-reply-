// ==============================================================================
// Johnny TEC AI Reply - API Client Module
// Attaches Bearer JWT access tokens from Supabase Auth to requests.
// Completely free of demo mocks; communicates exclusively with the backend.
// ==============================================================================

import { getActiveApiUrl } from './config.js';
import { getAccessToken, signOut } from './supabase.js';

async function request(path, options = {}) {
  const baseUrl = getActiveApiUrl();
  if (!baseUrl) {
    throw new Error("Backend URL is not configured. Check config.js");
  }
  const url = `${baseUrl}${path}`;
  const token = await getAccessToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 401 || response.status === 403) {
    // Auth expired or invalid owner
    let detail = "Session expired or unauthorized";
    try {
      const errJson = await response.json();
      if (errJson && errJson.detail) detail = errJson.detail;
    } catch (_) {}

    window.dispatchEvent(new CustomEvent('auth:expired', { detail: { status: response.status, message: detail } }));
    throw new Error(detail);
  }

  if (!response.ok) {
    let errMessage = `Server error ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson && errJson.detail) {
        errMessage = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch (_) {}
    throw new Error(errMessage);
  }

  return response.json();
}

export const API = {
  async checkHealth() {
    const baseUrl = getActiveApiUrl();
    if (!baseUrl) throw new Error("Backend URL missing");
    const res = await fetch(`${baseUrl}/health`);
    if (!res.ok) throw new Error(`Health status ${res.status}`);
    return res.json();
  },

  async getStats() {
    return request('/api/stats');
  },

  async getContacts(filter = "all") {
    return request(`/api/contacts?filter=${encodeURIComponent(filter)}`);
  },

  async getContact(contactId) {
    return request(`/api/contacts/${contactId}`);
  },

  async createContact(payload) {
    return request('/api/contacts', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateContact(contactId, updates) {
    return request(`/api/contacts/${contactId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  },

  async getMessages(contactId) {
    return request(`/api/contacts/${contactId}/messages`);
  },

  async sendManualMessage(contactId, text) {
    return request(`/api/contacts/${contactId}/send`, {
      method: 'POST',
      body: JSON.stringify({ text })
    });
  },

  async takeoverChat(contactId) {
    return request(`/api/contacts/${contactId}/takeover`, { method: 'POST' });
  },

  async handbackChat(contactId) {
    return request(`/api/contacts/${contactId}/handback`, { method: 'POST' });
  },

  async approveDraft(messageId, text) {
    return request(`/api/messages/${messageId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ text })
    });
  },

  async rejectDraft(messageId) {
    return request(`/api/messages/${messageId}/reject`, { method: 'POST' });
  },

  async regenerateDraft(messageId) {
    return request(`/api/messages/${messageId}/regenerate`, { method: 'POST' });
  },

  async getSettings() {
    return request('/api/settings');
  },

  async updateSettings(settings) {
    return request('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  },

  async getConnection() {
    return request('/api/connection');
  },

  async testConnection() {
    return request('/api/connection/test', { method: 'POST' });
  },

  async getLogs(type = "all") {
    return request(`/api/logs?type=${encodeURIComponent(type)}`);
  },

  async getErrors(category = "all") {
    return request(`/api/errors?category=${encodeURIComponent(category)}`);
  },

  async clearErrors() {
    return request('/api/errors', { method: 'DELETE' });
  }
};
