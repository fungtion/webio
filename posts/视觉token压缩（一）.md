## 视觉token压缩（一）

> 随着向多模态方向演进，大模型将不得不处理越来越多的高维连续的像素，并将其压缩成离散token，而过多的token会带来巨大的计算和存储开销，这对于大模型来说是一个巨大的挑战，因此，如何高效地将视觉信息压缩成离散token成为一个重要的研究方向。

这里介绍4篇比较新且具有代表性的论文，帮助我们了解视觉token压缩的最新进展。

1. [ApET: Approximation-Error Guided Token Compression for Efficient VLMs](https://arxiv.org/abs/2602.19870v1)

彻底抛弃了Attention的语义计算，采用是否能被线性重构的标准来去除非必要的视觉token：首先采用FPS（最远点采样）来选取基底token，然后计算剩下的每一个token与基底token的线性重构误差，如果误差小于阈值，则丢弃该token，否则保留该token。最后，将保留的token与基底token一起输入到VLM中进行训练。论文结果显示，ApET在保持VLM性能的同时，将token数量减少了85%以上。

作为一种纯代数层面的压缩方法，它的计算开销极低。它本质上是在关注画面中的“异类”与“高频信息”，并自然地过滤掉“同质化”的背景区域，这对端侧设备的部署非常友好。

2. [DUET-VLM: Dual stage Unified Efficient Token 
reduction for VLM Training and Inference](https://arxiv.org/abs/2602.18846)

采用了最符合直觉的“用户意图”对视觉token进行压缩，利用大语言模型的交叉注意力来精准地剥离与提示词无关的上下文，这些主要通过两阶段压缩完成：第一阶段通过在vision encoder和mlp adapter中加入一个vision-to-vision的视觉压缩模块去除视觉token中的冗余信息；第二阶段通过大语言模型的交叉注意力text-to-vision来精准地剥离与语义无关的token。论文结果显示，DUET-VLM在保持VLM性能的同时，将token数量减少了67%以上。

模型中的v2v模块的目的与ApET类似，都是通过相似性来压缩视觉token，会更加关注画面中的“异类”和“高频信息”，并合并那些“同质化”的背景区域。在t2v阶段，模型分别在第16层和第24层抛弃了50%和100%的视觉token（注意：在第24层抛弃100%视觉token并不意味着丢失图像信息，而是因为关键的视觉特征在前面层中已经充分提取并融合到了文本token的隐状态中，后续极深层只需依赖文本token做纯文本推理即可）。得益于此，注意力计算速度获得了大幅提升。虽然识别并抛弃无关视觉token的那2层需要暂时关闭flash-attention，但后续的纯文本计算层依然可以满血开启flash-attention，因此整体推理速度的收益非常可观。

3. [OneVision-Encoder: Codec-Aligned Sparsity as a Foundational Principle for Multimodal Intelligence](https://arxiv.org/abs/2602.08683)

其主要依据信息论的观点，认为视频中的“信息”主要蕴含在局部、随时间变化的“残差”中，而其它背景信息则相对冗余。因此，OneVision-Encoder构建了多个codec patchification策略：Dense Video-Codec Patchification, Chunck-wise Patchification, Single-Image Patchification, 其中第一个策略针对显著的运动目标，保留全部的I帧和后续P帧中有物理运动残差的局部patch，第二个策略主要是为了兼容常见的视频稀疏抽帧，第三个策略则是为了兼容常见的单图输入。试验结果显示，相比SigLIP2，在视觉token减少了75%-96.9%的情况下，性能甚至有超越。

OneVision-Encoder的主要优势在于它会关注视频中的高频部分，从而起到视觉token压缩的作用，而低频部分则通过I帧得以保存，因此在保持性能的同时，极大地减少了视觉token的数量。性能方面，由于压缩过程不涉及注意力计算，因此极大地提高了视觉token prefill的速度，而且不会影响后面使用flash-attention进行加速。

4. [Xray-Visual Models: Scaling Vision models on Industry Scale Data](https://arxiv.org/abs/2602.16918)

其将每层的[CLS]token来作为判断视觉token是否重要的依据，通过[CLS]token到所有patch tokens的注意力权重来判断视觉token的重要性，权重小于阈值的视觉token，将被抛弃。此外，值得注意的是该论文所使用的250亿条社交训练数据，给EViT带来了巨大的泛化性提升，在分类任务上超越了SigClip2和DINOv3。

在性能方面，与DUET-VLM类似，Xray-Visual Models也只在第4、8、11层设置了视觉token压缩，其他层依然使用flash-attention加速，因此在保持性能的同时，极大地提高了视觉token prefill的速度。

从上述4篇论文中，我们可以看到目前进行视觉token压缩的基本思路：

- 视觉部分可以单独压缩，基于视频运动原理、视频token之间的相关性等。这些通常不涉及跨模态的交叉注意力，可以作为前置环节，适用于非原生多模态的大模型。

- 用文本来引导视觉token的压缩，这种方法相比前一种独立压缩的方式，能进一步利用用户意图压缩冗余信息，但引入跨模态的交叉注意力必然会导致部分推理效率的损失。因此目前大多数做法是在个别网络层上进行压缩，它更适用于深度融合的多模态大模型。

但哪种方式更好，依然需要根据实际的使用场景与系统架构来做权衡。例如，如果你想在计算资源受限的端侧做加速，那么纯代数的 ApET 可能是更好的选择；而如果是在算力充足的服务器端追求极致的语义意图剥离，那么 DUET-VLM 无疑会更胜一筹。总之，每一种视觉token压缩的方式，本质上都是在系统性能、计算资源与模型表现之间寻找最优的折中点。
