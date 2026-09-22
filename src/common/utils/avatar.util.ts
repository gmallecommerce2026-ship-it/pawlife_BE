// src/common/utils/avatar.util.ts
import axios from 'axios';
import { createHash } from 'crypto';

/**
 * Suy ra tên hiển thị từ phần local-part của email.
 * "nguyen.van.a@gmail.com" -> "Nguyen Van A"
 */
export function formatNameFromEmail(email: string): string {
    const localPart = email.split('@')[0] || '';
    const cleaned = localPart.replace(/[._-]+/g, ' ').trim();
    if (!cleaned) return 'Người dùng';
    return cleaned
        .split(' ')
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

export function buildFallbackAvatarUrl(name: string): string {
    const encodedName = encodeURIComponent(name);
    return `https://ui-avatars.com/api/?name=${encodedName}&background=E89B5A&color=fff&size=256&bold=true`;
}
/**
 * Trả về URL Gravatar nếu email đã đăng ký ảnh đại diện,
 * nếu không thì fallback sang avatar chữ cái đầu (ui-avatars.com).
 */
export async function resolveAvatarUrl(email: string, name: string): Promise<string> {
    const hash = createHash('md5').update(email.trim().toLowerCase()).digest('hex');
    const gravatarCheckUrl = `https://www.gravatar.com/avatar/${hash}?d=404&s=256`;

    try {
        await axios.head(gravatarCheckUrl, { timeout: 3000 });
        return `https://www.gravatar.com/avatar/${hash}?s=256`;
    } catch {
        const encodedName = encodeURIComponent(name);
        return `https://ui-avatars.com/api/?name=${encodedName}&background=E89B5A&color=fff&size=256&bold=true`;
    }
}