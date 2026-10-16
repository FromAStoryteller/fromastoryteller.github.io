// Presentation only. The database independently authorizes every operation.
export function accountRoles(rows=[]){
 const roles=[...new Set(rows.map(row=>typeof row==='string'?row:row.role).filter(role=>['member','moderator','admin'].includes(role)))].sort();
 return {roles,role:roles.includes('admin')?'admin':roles.includes('moderator')?'moderator':roles.includes('member')?'member':'viewer',contributor:roles.includes('member'),admin:roles.includes('admin'),staff:roles.some(role=>['admin','moderator'].includes(role))};
}
export function roleLabel(roles=[]){return roles.map(role=>({member:'Contributor',admin:'Administrator',moderator:'Moderator'})[role]).filter(Boolean).join(' · ')||'Viewer';}
