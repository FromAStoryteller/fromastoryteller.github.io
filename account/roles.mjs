// Presentation only. The database independently authorizes every operation.
export function accountRoles(rows=[]){
 const roles=[...new Set(rows.map(row=>typeof row==='string'?row:row.role).filter(role=>['member','admin'].includes(role)))].sort();
 return {roles,role:roles.includes('admin')?'admin':roles.includes('member')?'member':'viewer',contributor:roles.includes('member'),admin:roles.includes('admin'),staff:roles.includes('admin')};
}
export function roleLabel(roles=[]){return roles.map(role=>({member:'Contributor',admin:'Administrator'})[role]).filter(Boolean).join(' · ')||'Viewer';}
