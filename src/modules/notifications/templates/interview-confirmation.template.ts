// src/modules/applications/templates/interview-confirmation.template.ts

interface InterviewEmailData {
  adopterName: string;
  petName: string;
  shelterName: string;
  appointmentDate: string;
  appointmentTime: string;
  isOnline: boolean;
  shelterAddress: string;      // luôn có (Shelter.address bắt buộc trong schema)
  googleMeetLink?: string;
  shelterPhone: string;        // luôn có (Shelter.contactInfo bắt buộc trong schema)
  shelterEmail?: string;       // optional (Shelter.emailAddress?)
}

export function renderInterviewConfirmationEmail(data: InterviewEmailData): { subject: string; html: string } {
  const appointmentType = data.isOnline ? 'Trực tuyến (Google Meet)' : 'Trực tiếp tại trạm';

  const html = `
    <p>Kính chào ${data.adopterName},</p>
    <p>Cảm ơn ${data.adopterName} đã quan tâm và đăng ký nhận nuôi ${data.petName} tại ${data.shelterName}.</p>
    <p>PawLife xin xác nhận lịch hẹn phỏng vấn của bạn với thông tin như sau:</p>
    <p><strong>Thời gian hẹn:</strong> ${data.appointmentDate} ${data.appointmentTime}</p>
    <p><strong>Hình thức gặp mặt:</strong> ${appointmentType}</p>
    ${!data.isOnline ? `<p><strong>Địa chỉ gặp mặt:</strong> ${data.shelterAddress}</p>` : ''}
    ${data.isOnline && data.googleMeetLink
      ? `<p><strong>Link Google Meet:</strong> <a href="${data.googleMeetLink}">${data.googleMeetLink}</a></p>`
      : ''
    }
    <p>Trong buổi hẹn, ${data.shelterName} sẽ phỏng vấn cũng như trao đổi thêm về thông tin của ${data.petName}, môi trường sống phù hợp, quá trình chăm sóc và các bước tiếp theo trong hành trình nhận nuôi.</p>
    <p>Cảm ơn ${data.adopterName} đã dành thời gian và mở rộng tình yêu thương để mang đến một mái ấm mới cho các bé thú cưng. Chúng mình rất mong được gặp bạn và cùng đồng hành trong hành trình này.</p>
    <p>Nếu bạn cần thay đổi lịch hẹn hoặc có bất kỳ câu hỏi nào, vui lòng liên hệ với:</p>
    <p>
      <strong>${data.shelterName}</strong><br/>
      Điện thoại: ${data.shelterPhone}<br/>
      Email: ${data.shelterEmail || 'Đang cập nhật'}
    </p>
    <p>Trân trọng,<br/>PawLife - Hành trình thú cưng</p>
  `;

  return {
    subject: `Xác nhận lịch phỏng vấn nhận nuôi ${data.petName} — ${data.shelterName}`,
    html,
  };
}