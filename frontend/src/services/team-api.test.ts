import { afterEach, describe, expect, it, vi } from "vitest";
import { api, clearCsrf } from "./api";
afterEach(() => { vi.unstubAllGlobals(); clearCsrf(); });
describe("teammate API responses", () => {
  it("reads the real list envelope without fabricating incident fields", async () => {
    const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify({success:true,incidents:[{id:7,title:"Reported event",incident_type:"Flood",status:"reported"}]})));
    vi.stubGlobal("fetch",fetchMock);
    await expect(api("/incidents")).resolves.toMatchObject({data:[{id:"7",incident_type:"Flood"}],meta:{total:1}});
  });
  it("posts incident fields without requesting a nonexistent CSRF endpoint", async () => {
    const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify({success:true,incident:{id:8,title:"Reported event"}}),{status:201}));
    vi.stubGlobal("fetch",fetchMock);
    await expect(api("/incidents",{method:"post",body:JSON.stringify({title:"Reported event",incident_type:"Flood"})})).resolves.toMatchObject({data:{id:"8"}});
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/incidents");
    expect(new Headers(fetchMock.mock.calls[0][1].headers).has("X-CSRF-Token")).toBe(false);
  });
  it("accepts a real 204 delete and surfaces backend validation errors", async () => {
    const fetchMock=vi.fn().mockResolvedValueOnce(new Response(null,{status:204})).mockResolvedValueOnce(new Response(JSON.stringify({success:false,errors:["incident_type is required"]}),{status:400}));
    vi.stubGlobal("fetch",fetchMock);
    await expect(api("/incidents/8",{method:"DELETE"})).resolves.toBeUndefined();
    await expect(api("/incidents",{method:"POST",body:"{}"})).rejects.toMatchObject({status:400,message:"incident_type is required"});
  });
  it("reports missing auth and never supplies a substitute user", async () => {
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response("Cannot GET /api/auth/me",{status:404})));
    await expect(api("/auth/me")).rejects.toMatchObject({status:404,endpoint:"GET /api/auth/me",message:expect.stringMatching(/not available yet/)});
  });
});
