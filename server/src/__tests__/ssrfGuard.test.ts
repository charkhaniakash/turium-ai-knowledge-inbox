import { describe, it, expect } from 'vitest';
import { assertNotSsrf } from '../services/url/ssrfGuard';
import { UnprocessableContentError } from '../lib/errors';

/**
 * SSRF guard tests use IP addresses directly to avoid real DNS lookups.
 * This keeps tests fast, deterministic, and offline-capable.
 */

async function expectBlocked(url: string): Promise<void> {
  await expect(assertNotSsrf(url)).rejects.toThrow(UnprocessableContentError);
}

async function expectAllowed(url: string): Promise<void> {
  await expect(assertNotSsrf(url)).resolves.toBeUndefined();
}

describe('ssrfGuard', () => {
  describe('loopback addresses', () => {
    it('blocks 127.0.0.1', () => expectBlocked('http://127.0.0.1/secret'));
    it('blocks 127.0.0.2', () => expectBlocked('http://127.0.0.2/'));
    it('blocks ::1 (IPv6 loopback)', () => expectBlocked('http://[::1]/'));
  });

  describe('private IPv4 ranges', () => {
    it('blocks 10.0.0.1 (RFC 1918)', () => expectBlocked('http://10.0.0.1/'));
    it('blocks 10.255.255.255', () => expectBlocked('http://10.255.255.255/'));
    it('blocks 172.16.0.1 (RFC 1918)', () => expectBlocked('http://172.16.0.1/'));
    it('blocks 172.31.255.255', () => expectBlocked('http://172.31.255.255/'));
    it('blocks 192.168.1.1 (RFC 1918)', () => expectBlocked('http://192.168.1.1/'));
    it('blocks 192.168.0.1', () => expectBlocked('http://192.168.0.1/'));
  });

  describe('link-local and metadata', () => {
    it('blocks 169.254.169.254 (AWS metadata)', () =>
      expectBlocked('http://169.254.169.254/latest/meta-data/'));
    it('blocks 169.254.0.1', () => expectBlocked('http://169.254.0.1/'));
  });

  describe('private IPv6 ranges', () => {
    it('blocks fc00:: (unique local)', () => expectBlocked('http://[fc00::1]/'));
    it('blocks fd00:: (unique local)', () => expectBlocked('http://[fd00::1]/'));
    it('blocks fe80:: (link-local)', () => expectBlocked('http://[fe80::1]/'));
  });

  describe('public addresses', () => {
    it('allows 8.8.8.8 (Google DNS)', () => expectAllowed('http://8.8.8.8/'));
    it('allows 1.1.1.1 (Cloudflare)', () => expectAllowed('http://1.1.1.1/'));
    it('allows 93.184.216.34 (example.com)', () =>
      expectAllowed('http://93.184.216.34/'));
  });

  describe('edge cases', () => {
    it('throws UnprocessableContentError for invalid URL', () =>
      expectBlocked('not-a-url'));

    it('blocks 172.16.0.0 exactly (boundary)', () =>
      expectBlocked('http://172.16.0.0/'));

    it('allows 172.32.0.1 (just outside RFC 1918 /12 range)', () =>
      expectAllowed('http://172.32.0.1/'));

    it('allows 192.169.0.1 (not in 192.168/16)', () =>
      expectAllowed('http://192.169.0.1/'));
  });
});
