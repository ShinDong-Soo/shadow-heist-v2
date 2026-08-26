import{d as e}from"./foundation3d-BLXwU5ng.js";const a="defaultUboDeclaration",i=`layout(std140,column_major) uniform;uniform Material
{vec4 diffuseLeftColor;vec4 diffuseRightColor;vec4 opacityParts;vec4 reflectionLeftColor;vec4 reflectionRightColor;vec4 refractionLeftColor;vec4 refractionRightColor;vec4 emissiveLeftColor;vec4 emissiveRightColor;vec2 vDiffuseInfos;vec2 vAmbientInfos;vec2 vOpacityInfos;vec2 vEmissiveInfos;vec2 vLightmapInfos;vec2 vSpecularInfos;vec3 vBumpInfos;mat4 diffuseMatrix;mat4 ambientMatrix;mat4 opacityMatrix;mat4 emissiveMatrix;mat4 lightmapMatrix;mat4 specularMatrix;mat4 bumpMatrix;vec2 vTangentSpaceParams;float pointSize;float alphaCutOff;mat4 refractionMatrix;vec4 vRefractionInfos;vec3 vRefractionPosition;vec3 vRefractionSize;vec4 vSpecularColor;vec3 vEmissiveColor;vec4 vDiffuseColor;vec3 vAmbientColor;vec4 cameraInfo;vec4 vTextureRepetitionHexTilingParams;vec2 vReflectionInfos;mat4 reflectionMatrix;vec3 vReflectionPosition;vec3 vReflectionSize;
#define ADDITIONAL_UBO_DECLARATION
};
#include<sceneUboDeclaration>
#include<meshUboDeclaration>
`;e.IncludesShadersStore[a]||(e.IncludesShadersStore[a]=i);const s={name:a,shader:i},o="mainUVVaryingDeclaration",r=`#ifdef MAINUV{X}
varying vec2 vMainUV{X};
#endif
`;e.IncludesShadersStore[o]||(e.IncludesShadersStore[o]=r);const f={name:o,shader:r},t="logDepthDeclaration",n=`#ifdef LOGARITHMICDEPTH
uniform float logarithmicDepthConstant;varying float vFragmentDepth;
#endif
`;e.IncludesShadersStore[t]||(e.IncludesShadersStore[t]=n);const v={name:t,shader:n};export{s as d,v as l,f as m};
