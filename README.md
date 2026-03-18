# 🎓 UniSearch

UniSearch is a high-performance, responsive student database and search engine built for modern educational institutions. It provides a seamless interface for students to find their peers and for administrators to manage records through bulk imports and detailed academic performance tracking.

## 🧱 Tech Stack
*   **Frontend**: HTML5, CSS3, Vanilla JS (ES6+), [Tailwind CSS](https://tailwindcss.com), [Font Awesome](https://fontawesome.com).
*   **Backend**: PHP 8.2 (Serverless PHP via Vercel Runtime), Supabase REST API for database communication.
*   **Database**: Supabase Managed PostgreSQL.
*   **Export Support**: [jsPDF](https://github.com/parallax/jsPDF) and [SheetJS](https://sheetjs.com) for PDF and Excel exports.
*   **Animations**: [AOS.js](http://michalsnik.github.io/aos/) and [CountUp.js](https://inorganik.github.io/countUp.js/).

## 🚀 Key Features
*   **Instant Search**: Full-text search with autocomplete across 1,000+ records.
*   **Advanced Filters**: Filter by Department, Admission Year, Graduation Year, Current Semester, and Enrollment Status.
*   **Dual View**: Switch between **Table View** for dense data and **Grid View** for student profile cards.
*   **Academic History**: Track students across their entire educational journey with detailed semester-wise CGPA and attendance reports.
*   **Admin Dashboard**:
    *   **Bulk Import**: Upload `.xlsx` or `.csv` files to import hundreds of students instantly.
    *   **Dashboard Stats**: Beautiful, animated charts mapping student distribution by batch.
    *   **Result Management**: Add or update individual semester results with a few clicks.
*   **Premium Design**: Dark mode default, Glassmorphism elements, and fully responsive across mobile and desktop.
*   **PDF/Excel Reports**: Export filtered student lists with custom styling.

## 🛠️ Getting Started
1.  **Clone the Repo**: `git clone https://github.com/your-username/UniSearch.git`
2.  **Local Dev**: Run `vercel dev` if you have the [Vercel CLI](https://vercel.com/docs/cli) installed, or serve the `public/` folder while ignoring API routes locally.
3.  **Deployment**: See [DEPLOYMENT.md](./DEPLOYMENT.md) for a step-by-step guide to setting up Supabase and Vercel.

## 🔐 Admin Access
The default admin password is set to `admin123` via the `.env.example` file. This can be changed in your Vercel project settings or Supabase secrets.

---
Built with ❤️ for universities everywhere.
