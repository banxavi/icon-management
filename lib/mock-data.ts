export type Role = 'Member' | 'Team Leader' | 'Reviewer' | 'Admin'

export const members = Array.from({ length: 17 }, (_, i) => ({
  id: `member-${i + 1}`,
  name: ['Nguyễn Minh Anh', 'Trần Quốc Bảo', 'Lê Hoàng Nam', 'Phạm Thu Hà', 'Đỗ Đức Long'][i % 5],
  role: i === 0 ? 'Team Leader' : 'Member',
  initials: ['MA', 'QB', 'LN', 'TH', 'DL'][i % 5],
}))

export const projects = ['ICON Core', 'Support Platform', 'Internal Tools']

export const dailyReports = [
  { id: 'DR-2408', date: '24/10/2026', project: 'ICON Core', status: 'Đã nộp', summary: 'Hoàn thiện luồng phân quyền và cập nhật tài liệu triển khai.' },
  { id: 'DR-2407', date: '23/10/2026', project: 'Support Platform', status: 'Đã nộp', summary: 'Xử lý lỗi đồng bộ ticket và review PR của team.' },
  { id: 'DR-2406', date: '22/10/2026', project: 'ICON Core', status: 'Đã nộp', summary: 'Tích hợp màn hình dashboard mới.' },
  { id: 'DR-2405', date: '21/10/2026', project: 'Internal Tools', status: 'Đã nộp', summary: 'Phân tích yêu cầu cho module báo cáo tuần.' },
  { id: 'DR-2404', date: '20/10/2026', project: 'ICON Core', status: 'Chưa nộp', summary: 'Chưa có nội dung.' },
]

export const teamDailyStatus = members.map((member, index) => ({
  ...member,
  project: projects[index % projects.length],
  status: index % 7 === 2 ? 'Nộp trễ' : index % 9 === 4 ? 'Nghỉ' : index % 5 === 0 ? 'Chưa nộp' : 'Đã nộp',
  workMode: index % 4 === 0 ? 'WFH' : 'Office',
  wfhReason: index % 4 === 0 ? 'Đón con và xử lý việc gia đình.' : '',
  blocker: index % 6 === 0 ? 'Vướng mắc' : '',
  summary: index % 6 === 0 ? 'Đang chờ quyền truy cập môi trường staging.' : 'Hoàn thành các hạng mục theo kế hoạch ngày.',
}))

export const teamWeeklySummary = projects.map((project, index) => ({
  project,
  members: [5, 6, 6][index],
  submitted: [4, 5, 5][index],
  progress: ['82%', '74%', '91%'][index],
  highlight: ['Hoàn thiện luồng phân quyền.', 'Ổn định đồng bộ ticket.', 'Chốt scope module báo cáo.'][index],
}))

export const requests = [
  { id: 'REQ-001', member: members[1].name, type: 'Quyền truy cập', title: 'Cấp quyền staging', status: 'Mới', created: '24/10/2026' },
  { id: 'REQ-002', member: members[3].name, type: 'Thiết bị', title: 'Thay bàn phím', status: 'Đang xử lý', created: '23/10/2026' },
  { id: 'REQ-003', member: members[6].name, type: 'Đào tạo', title: 'Khóa học observability', status: 'Hoàn tất', created: '21/10/2026' },
]

export const announcements = [
  { title: 'Cập nhật quy trình báo cáo', date: '24/10/2026', body: 'Từ tuần này, báo cáo daily cần được hoàn tất trước 18:00 mỗi ngày.', pinned: true },
  { title: 'Bảo trì hệ thống cuối tuần', date: '23/10/2026', body: 'Portal sẽ bảo trì từ 22:00 đến 23:30 thứ Bảy.', pinned: false },
]

export const documents = [
  { id: 'DOC-01', name: 'Quy chế WFH', folder: 'Quy định chung', version: 'v2.1', uploader: 'Nguyễn Minh Anh', updated: '24/10/2026', tags: ['WFH', 'Quan trọng'], confirm: true, kind: 'PDF' },
  { id: 'DOC-02', name: 'Quy trình báo cáo', folder: 'Quy trình', version: 'v1.4', uploader: 'Trần Quốc Bảo', updated: '23/10/2026', tags: ['Báo cáo'], confirm: true, kind: 'PDF' },
  { id: 'DOC-03', name: 'Onboarding checklist', folder: 'Hướng dẫn', version: 'v3.0', uploader: 'Phạm Thu Hà', updated: '20/10/2026', tags: ['Onboarding'], confirm: false, kind: 'XLSX' },
  { id: 'DOC-04', name: 'Kiến trúc ICON Core', folder: 'Dự án', version: 'v1.8', uploader: 'Lê Hoàng Nam', updated: '18/10/2026', tags: ['ICON Core', 'Kỹ thuật'], confirm: false, kind: 'PNG' },
]

export const notifications = [
  { id: 'NTF-01', title: 'Bạn cần xác nhận đã đọc Quy chế WFH', body: 'Tài liệu quan trọng vừa được cập nhật.', time: '10 phút trước', unread: true },
  { id: 'NTF-02', title: 'Báo cáo daily đã được ghi nhận', body: 'Báo cáo DR-2408 đã nộp thành công.', time: 'Hôm nay, 09:20', unread: true },
  { id: 'NTF-03', title: 'Bảo trì hệ thống cuối tuần', body: 'Portal sẽ bảo trì từ 22:00 thứ Bảy.', time: 'Hôm qua', unread: false },
]

export const skills = ['TypeScript', 'Next.js', 'Product thinking', 'Observability']
