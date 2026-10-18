import {invitationEmail as v1,MAIL_FROM} from './invitation-email-v1.mjs';
import {invitationEmail as v2} from './invitation-email-v2.mjs';
export {MAIL_FROM};
export function invitationEmail(job,options){
 if(job.template_version===2)return v2(job,options);
 if(job.template_version==null||job.template_version===1)return v1(job,options);
 throw new Error('Unsupported invitation rendering version');
}
