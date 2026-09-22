export function renderInviteMemberEmail(params: {
  shelterName: string;
  inviterName: string;
  role: string;
  inviteUrl: string;
}) {
  const { shelterName, inviterName, role, inviteUrl } = params;
  const roleLabel: Record<string, string> = {
    ADMIN: 'Quản trị viên',
    MEMBER: 'Thành viên',
    VOLUNTEER: 'Tình nguyện viên',
    VETERINARIAN: 'Bác sĩ thú y',
  };

  const subject = `Lời mời tham gia trạm cứu hộ ${shelterName} trên PawLife`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color:#1E1B4B;">Bạn được mời tham gia ${shelterName}</h2>
      <p style="color:#444; font-size:14px; line-height:1.6;">
        ${inviterName} đã mời bạn tham gia trạm cứu hộ <strong>${shelterName}</strong> trên PawLife
        với vai trò <strong>${roleLabel[role] || role}</strong>.
      </p>
      <a href="${inviteUrl}"
        style="display:inline-block; margin-top:16px; padding:12px 28px; background:#E89B5A; color:#fff;
        text-decoration:none; border-radius:8px; font-weight:bold;">
        Chấp nhận lời mời
      </a>
      <p style="color:#999; font-size:12px; margin-top:24px;">
        Liên kết này sẽ hết hạn sau 7 ngày. Nếu bạn không mong đợi email này, vui lòng bỏ qua.
      </p>
    </div>
  `;
  return { subject, html };
}