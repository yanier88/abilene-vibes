export const reasons = Object.freeze({spam:'Spam',harassment:'Harassment or abusive content',inappropriate:'Inappropriate content',misleading:'False or misleading information',illegal:'Illegal or prohibited content',other:'Other'});
export async function rpc(client,name,args) {
 if (!client) throw Error('UNAVAILABLE');
 const {data,error}=await client.rpc(name,args);
 if(error) throw Error('Unable to complete this action. Please try again later.');
 return data;
}
