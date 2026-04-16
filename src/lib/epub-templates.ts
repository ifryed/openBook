/**
 * EPUB 3 XHTML/OPF templates derived from epub-gen-memory defaults, with RTL support.
 * EJS placeholders use <%= %>; `${...}` is TypeScript interpolation only.
 */

export function epub3ChapterXhtmlTemplate(dir: "ltr" | "rtl"): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="<%= lang %>" lang="<%= lang %>" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <title><%= title %></title>
  <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body>
  <% if (prependChapterTitles) { %>
    <h1><%= title %></h1>
    <% if (author.length) { %>
      <p class="epub-author"><%= author.join(', ') %></p>
    <% } %>
    <% if (url) { %>
      <p class="epub-link"><a href="<%= url %>"><%= url %></a></p>
    <% } %>
  <% } %>
  <%- content %>
</body>
</html>`;
}

export function epub3TocXhtmlTemplate(dir: "ltr" | "rtl"): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="<%- lang %>" lang="<%- lang %>" dir="${dir}">
<head>
    <title><%= title %></title>
    <meta charset="UTF-8" />
    <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body>
    <h1 class="h1"><%= tocTitle %></h1>
    <nav id="toc" epub:type="toc">
        <% if (numberChaptersInTOC){ %>
            <ol>
        <% }else{ %>
            <ol style="list-style: none">
        <% } %>
            <% content.forEach(function(content, index){ %>
                <% if(!content.excludeFromToc){ %>
                    <li class="table-of-content">
                        <a href="<%= content.filename %>"><%= content.title %>
                            <% if(content.author.length){ %>
                                - <small class="toc-author"><%= content.author.join(",") %></small>
                            <% }%>
                        </a>
                        <% if(content.url){ %><span class="toc-link"><%= content.url %></span><% }%>
                    </li>
                <% } %>
            <% }) %>
        </ol>
    </nav>
</body>
</html>`;
}

/** Same package document as epub-gen-memory EPUB 3, with optional RTL spine progression. */
export function epub3ContentOpfTemplate(isRtl: boolean): string {
  const spineAttr = isRtl ? ' page-progression-direction="rtl"' : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf"
         version="3.0"
         unique-identifier="BookId"
         xmlns:dc="http://purl.org/dc/elements/1.1/"
         xmlns:dcterms="http://purl.org/dc/terms/"
         xml:lang="en"
         xmlns:media="http://www.idpf.org/epub/vocab/overlays/#"
         prefix="ibooks: http://vocabulary.itunes.apple.com/rdf/ibooks/vocabulary-extensions-1.0/">

    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"
              xmlns:opf="http://www.idpf.org/2007/opf">

        <dc:identifier id="BookId"><%= id %></dc:identifier>
        <meta refines="#BookId" property="identifier-type" scheme="onix:codelist5">22</meta>
        <meta property="dcterms:identifier" id="meta-identifier">BookId</meta>
        <dc:title><%= title %></dc:title>
        <meta property="dcterms:title" id="meta-title"><%= title %></meta>
        <dc:description><%= description %></dc:description>
        <dc:language><%= lang %></dc:language>
        <meta property="dcterms:language" id="meta-language"><%= lang %></meta>
        <meta property="dcterms:modified"><%= (new Date()).toISOString().split(".")[0]+ "Z" %></meta>
        <dc:creator id="creator"><%= author.join(",") %></dc:creator>
        <meta refines="#creator" property="file-as"><%= author.join(",") %></meta>
        <meta property="dcterms:publisher"><%= publisher %></meta>
        <dc:publisher><%= publisher %></dc:publisher>
        <meta property="dcterms:date"><%= date %></meta>
        <dc:date><%= date %></dc:date>
        <meta property="dcterms:rights">All rights reserved</meta>
        <dc:rights>Copyright &#x00A9; <%= (new Date()).getFullYear() %> by <%= publisher %></dc:rights>
        <% if(cover) { %>
        <meta name="cover" content="image_cover"/>
        <% } %>
        <meta name="generator" content="epub-gen" />
        <meta property="ibooks:specified-fonts">true</meta>

    </metadata>

    <manifest>
        <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml" />
        <item id="toc" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav" />
        <item id="css" href="style.css" media-type="text/css" />

        <% if(cover) { %>
        <item id="image_cover" href="cover.<%= cover.extension %>" media-type="<%= cover.mediaType %>" />
        <% } %>
        
        <% images.forEach(function(image, index){ %>
        <item id="image_<%= index %>" href="images/<%= image.id %>.<%= image.extension %>" media-type="<%= image.mediaType %>" />
        <% }) %>
        
        <% content.forEach(function(content, index){ %>
        <item id="content_<%= index %>_<%= content.id %>" href="<%= content.filename %>" media-type="application/xhtml+xml" />
        <% }) %>

        <% fonts.forEach(function(font, index){%>
        <item id="font_<%= index%>" href="fonts/<%= font.filename %>" media-type="<%= font.mediaType %>" />
        <%})%>
    </manifest>

    <spine toc="ncx"${spineAttr}>
        <% content.forEach(function(content, index){ %>
            <% if(content.beforeToc){ %>
                <itemref idref="content_<%= index %>_<%= content.id %>"/>
            <% } %>
        <% }) %>
        <itemref idref="toc" />
        <% content.forEach(function(content, index){ %>
            <% if(!content.beforeToc){ %>
                <itemref idref="content_<%= index %>_<%= content.id %>"/>
            <% } %>
        <% }) %>
    </spine>
    <guide>
        <reference type="text" title="Table of Content" href="toc.xhtml"/>
    </guide>
</package>`;
}
