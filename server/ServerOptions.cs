using System.Collections.Generic;

namespace StarterProject
{
    public class ServerOptions
    {
        public string OidcServer { get; set; }
        public string OidcAudience { get; set; }
        public List<string> PermittedOrigins { get; set; }
    }
}
