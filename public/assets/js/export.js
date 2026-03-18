/**
 * UniSearch Export Manager
 * PDF and Excel handling
 */

window.exportManager = {
    async fetchAll() {
        const params = new URLSearchParams({
            q: state.query,
            enrollment_status: state.status,
            department_id: state.department_id,
            admission_year: state.admission_year,
            graduation_year: state.graduation_year,
            current_year: state.current_year,
            limit: 1000 // Get all matching
        });
        
        const res = await fetch(`/api/search?${params.toString()}`);
        return await res.json();
    },

    async pdf() {
        const { jsPDF } = window.jspdf;
        const data = await this.fetchAll();
        const doc = new jsPDF('landscape');
        
        // Header
        doc.setFontSize(22);
        doc.setTextColor(99, 102, 241);
        doc.text('UniSearch Student Registry', 14, 22);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
        doc.text(`Filtered Records: ${data.total}`, 14, 35);
        
        const tableData = data.data.map((s, i) => [
            i + 1,
            s.full_name,
            s.student_id,
            s.department_name,
            s.batch,
            `Year ${s.current_year}`,
            s.cgpa_latest || 'N/A',
            s.enrollment_status.toUpperCase()
        ]);
        
        doc.autoTable({
            startY: 45,
            head: [['#', 'Full Name', 'Student ID', 'Department', 'Batch', 'Year', 'CGPA', 'Status']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [99, 102, 241] },
            alternateRowStyles: { fillColor: [240, 240, 255] }
        });
        
        doc.save(`unisearch-export-${new Date().toISOString().split('T')[0]}.pdf`);
    },

    async excel() {
        const data = await this.fetchAll();
        const ws = XLSX.utils.json_to_sheet(data.data.map(s => ({
            'Full Name': s.full_name,
            'Student ID': s.student_id,
            'Email': s.email,
            'Department': s.department_name,
            'Batch': s.batch,
            'Year': s.current_year,
            'Semester': s.current_semester,
            'Enrollment Status': s.enrollment_status,
            'Latest CGPA': s.cgpa_latest,
            'Phone': s.phone_number
        })));
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Students");
        
        XLSX.writeFile(wb, `unisearch-export-${new Date().toISOString().split('T')[0]}.xlsx`);
    }
};
