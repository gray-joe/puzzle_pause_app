const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(dateStr: string): string {
    const [year, month, day] = dateStr.split('-').map(Number);
    return `${day} ${MONTHS[month - 1]} ${year}`;
}
